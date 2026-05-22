import { ethers } from "ethers";
import { config } from "dotenv";
config({ path: ".env.local" }); 

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const WS_URL = process.env.WS_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const VRF_ADDRESS = process.env.VRF_ADDRESS;
const GAME_ADDRESS = process.env.GAME_ADDRESS;
const ROD_ADDRESS = process.env.ROD_ADDRESS;

const GAME_ABI = [
  "event CastRequested(uint256 indexed roomId, address player, uint256 requestId)",
  "event RecastStarted(uint256 indexed roomId, address player, uint256 recastNumber)",
  "function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external",
];

const ROD_ABI = [
  "event UpgradeRequested(uint256 indexed tokenId, uint256 indexed requestId, address indexed requester, uint8 fromLevel)",
];

const VRF_ABI = [
  "function fulfill(uint256 reqId) external",
];

function requireAddress(name, value) {
  if (!value) {
    console.error(`缺少环境变量：${name}`);
    process.exit(1);
  }
  if (!ethers.isAddress(value)) {
    console.error(`地址格式不正确：${name}=${value}`);
    process.exit(1);
  }
  return value;
}

if (!PRIVATE_KEY) {
  console.error("缺少环境变量：PRIVATE_KEY");
  process.exit(1);
}

requireAddress("VRF_ADDRESS", VRF_ADDRESS);
requireAddress("GAME_ADDRESS", GAME_ADDRESS);
if (ROD_ADDRESS) requireAddress("ROD_ADDRESS", ROD_ADDRESS);

const provider = WS_URL ? new ethers.WebSocketProvider(WS_URL) : new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const game = new ethers.Contract(GAME_ADDRESS, GAME_ABI, provider);
const vrfInterface = new ethers.Interface(VRF_ABI);
const rod = ROD_ADDRESS ? new ethers.Contract(ROD_ADDRESS, ROD_ABI, provider) : null;

console.log("🎣 AutoFulfill 监听中...");
console.log(`RPC:      ${RPC_URL}`);
if (WS_URL) console.log(`WS:       ${WS_URL}`);
console.log(`Game:     ${GAME_ADDRESS}`);
if (rod) console.log(`Rod:      ${ROD_ADDRESS}`);
console.log(`VRF地址:  ${VRF_ADDRESS}`);
console.log("等待 CastRequested / RecastStarted / UpgradeRequested 事件...\n");

const inFlight = new Set();

async function requireContractCode(name, address) {
  const code = await provider.getCode(address);
  if (!code || code === "0x") {
    console.error(`${name} 不是合约地址（getCode=0x）：${address}`);
    console.error("请检查是否重启过 anvil、以及环境变量是否指向当前这条链上部署出来的地址。");
    process.exit(1);
  }
}

await requireContractCode("VRF_ADDRESS", VRF_ADDRESS);
await requireContractCode("GAME_ADDRESS", GAME_ADDRESS);
if (ROD_ADDRESS) await requireContractCode("ROD_ADDRESS", ROD_ADDRESS);

async function fulfill(requestId) {
  const key = requestId?.toString?.() ?? String(requestId);
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  await new Promise((r) => setTimeout(r, 250));
  try {
    const data = vrfInterface.encodeFunctionData("fulfill", [requestId]);
    const tx = await signer.sendTransaction({ to: VRF_ADDRESS, data });
    await tx.wait();
    return tx.hash;
  } finally {
    inFlight.delete(key);
  }
}

async function backfillRecentRequests() {
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 800);

  const requestIds = new Set();

  try {
    const logs = await game.queryFilter(game.filters.CastRequested(), fromBlock, "latest");
    for (const l of logs) {
      const requestId = l?.args?.[2];
      if (requestId !== undefined && requestId !== null) requestIds.add(requestId.toString());
    }
  } catch {}

  if (rod) {
    try {
      const logs = await rod.queryFilter(rod.filters.UpgradeRequested(), fromBlock, "latest");
      for (const l of logs) {
        const requestId = l?.args?.[1];
        if (requestId !== undefined && requestId !== null) requestIds.add(requestId.toString());
      }
    } catch {}
  }

  const ids = [...requestIds];
  if (ids.length === 0) return;

  console.log(`检测到近 ${currentBlock - fromBlock} 个区块内可能未回调的请求：${ids.length} 个`);
  for (const id of ids) {
    try {
      const txHash = await fulfill(BigInt(id));
      if (txHash) console.log(`✅ 已回调 requestId=${id} tx=${txHash}`);
    } catch (e) {
      const msg = e?.shortMessage || e?.message || String(e);
      console.log(`⏭️  跳过 requestId=${id}（可能已回调或不可回调）：${msg}`);
    }
  }
  console.log("");
}

await backfillRecentRequests();

// 监听 CastRequested（初次抛竿）
game.on("CastRequested", async (roomId, player, requestId) => {
  console.log(`\n🎯 检测到抛竿！`);
  console.log(`   房间: ${roomId}  玩家: ${player}`);
  console.log(`   RequestId: ${requestId}`);

  try {
    console.log(`   触发 VRF 回调...`);
    const txHash = await fulfill(requestId);
    if (txHash) console.log(`   ✅ VRF 回调成功！tx: ${txHash}`);
    else console.log(`   ⏭️  已在回调中，跳过重复请求`);
  } catch (e) {
    console.error(`   ❌ VRF 回调失败:`, e.message);
  }
});

// 监听 RecastStarted（重投）
game.on("RecastStarted", async (roomId, player, recastNumber) => {
  console.log(`\n🎲 检测到重投！`);
  console.log(`   房间: ${roomId}  玩家: ${player}  第${recastNumber}次重投`);

  try {
    const filter = game.filters.CastRequested();
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 200);
    const logs = await game.queryFilter(filter, fromBlock, "latest");
    if (logs.length === 0) {
      console.error("   ❌ 找不到对应的 CastRequested 事件");
      return;
    }
    const candidates = logs.filter((l) => {
      const args = l.args;
      if (!args) return false;
      const rid = args[0];
      const p = args[1];
      return rid === roomId && typeof p === "string" && p.toLowerCase() === player.toLowerCase();
    });
    const latest = (candidates.length > 0 ? candidates : logs)[(candidates.length > 0 ? candidates : logs).length - 1];
    const requestId = latest.args[2];

    console.log(`   RequestId: ${requestId}`);
    console.log(`   触发 VRF 回调...`);
    const txHash = await fulfill(requestId);
    if (txHash) console.log(`   ✅ VRF 回调成功！tx: ${txHash}`);
    else console.log(`   ⏭️  已在回调中，跳过重复请求`);
  } catch (e) {
    console.error(`   ❌ VRF 回调失败:`, e.message);
  }
});

if (rod) {
  rod.on("UpgradeRequested", async (tokenId, requestId, requester, fromLevel) => {
    console.log(`\n⬆️  检测到升级请求！`);
    console.log(`   TokenId: ${tokenId}  FromLevel: ${fromLevel}`);
    console.log(`   RequestId: ${requestId}  Requester: ${requester}`);

    try {
      console.log(`   触发 VRF 回调...`);
      const txHash = await fulfill(requestId);
      if (txHash) console.log(`   ✅ VRF 回调成功！tx: ${txHash}`);
      else console.log(`   ⏭️  已在回调中，跳过重复请求`);
    } catch (e) {
      console.error(`   ❌ VRF 回调失败:`, e.message);
    }
  });
}

// 保持进程运行
process.on("SIGINT", () => {
  console.log("\n停止监听");
  process.exit();
});
