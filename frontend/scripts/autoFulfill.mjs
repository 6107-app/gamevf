import { ethers } from "ethers";

const RPC_URL = "http://127.0.0.1:8545";
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const GAME_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const VRF_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const GAME_ABI = [
  "event CastRequested(uint256 indexed roomId, address player, uint256 requestId)",
  "event RecastStarted(uint256 indexed roomId, address player, uint256 recastNumber)",
  "function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external",
];

const VRF_ABI = [
  "function fulfill(address game, uint256 reqId) external",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const game = new ethers.Contract(GAME_ADDRESS, GAME_ABI, provider);
const vrf = new ethers.Contract(VRF_ADDRESS, VRF_ABI, signer);

console.log("🎣 AutoFulfill 监听中...");
console.log(`合约地址: ${GAME_ADDRESS}`);
console.log(`VRF地址:  ${VRF_ADDRESS}`);
console.log("等待 CastRequested / RecastStarted 事件...\n");

// 监听 CastRequested（初次抛竿）
game.on("CastRequested", async (roomId, player, requestId) => {
  console.log(`\n🎯 检测到抛竿！`);
  console.log(`   房间: ${roomId}  玩家: ${player}`);
  console.log(`   RequestId: ${requestId}`);
  
  // 等1秒再触发，模拟VRF延迟
  await new Promise(r => setTimeout(r, 1000));
  
  try {
    console.log(`   触发 VRF 回调...`);
    const tx = await vrf.fulfill(GAME_ADDRESS, requestId);
    await tx.wait();
    console.log(`   ✅ VRF 回调成功！tx: ${tx.hash}`);
  } catch (e) {
    console.error(`   ❌ VRF 回调失败:`, e.message);
  }
});

// 监听 RecastStarted（重投）
game.on("RecastStarted", async (roomId, player, recastNumber) => {
  console.log(`\n🎲 检测到重投！`);
  console.log(`   房间: ${roomId}  玩家: ${player}  第${recastNumber}次重投`);

  // 读取最新的 requestId（recast 也会触发 VRF 请求）
  // 通过监听最近的交易日志来获取 requestId
  await new Promise(r => setTimeout(r, 500));

  try {
    // 获取最新区块的日志找到 requestId
    const filter = game.filters.CastRequested();
    const logs = await game.queryFilter(filter, -5);
    if (logs.length === 0) {
      console.error("   ❌ 找不到对应的 CastRequested 事件");
      return;
    }
    const latest = logs[logs.length - 1];
    const requestId = latest.args[2];
    
    console.log(`   RequestId: ${requestId}`);
    console.log(`   触发 VRF 回调...`);
    const tx = await vrf.fulfill(GAME_ADDRESS, requestId);
    await tx.wait();
    console.log(`   ✅ VRF 回调成功！tx: ${tx.hash}`);
  } catch (e) {
    console.error(`   ❌ VRF 回调失败:`, e.message);
  }
});

// 保持进程运行
process.on("SIGINT", () => {
  console.log("\n停止监听");
  process.exit();
});