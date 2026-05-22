#!/bin/bash
echo "🚀 启动开发环境..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
PRIVATE_KEY="${PRIVATE_KEY:-}"

# 第一步：启动 Anvil
echo "⛏️  启动 Anvil..."
ANVIL_PORT="$(echo "$RPC_URL" | awk -F: '{print $NF}')"
EXISTING_PID="$(lsof -nP -iTCP:"$ANVIL_PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1)"
if [ -n "$EXISTING_PID" ]; then
  echo "✅ Anvil 已在运行 (PID: $EXISTING_PID)"
else
  anvil --dump-state "$ROOT_DIR/anvil-state.json" --chain-id 31337 --host 0.0.0.0 --port "$ANVIL_PORT" &
  ANVIL_PID=$!
  echo "✅ Anvil 启动 (PID: $ANVIL_PID)"
fi

# 等待 Anvil 就绪
sleep 3

# 第二步：挖矿让区块高度超过 MetaMask 缓存
echo "⛏️  同步区块高度..."
cast rpc anvil_mine 110 --rpc-url "$RPC_URL"

# 第三步：部署合约
echo "📦 部署合约..."
if [ -z "$PRIVATE_KEY" ]; then
  ENV_LOCAL="$ROOT_DIR/frontend/.env.local"
  if [ -f "$ENV_LOCAL" ]; then
    PRIVATE_KEY="$(grep -E '^PRIVATE_KEY=' "$ENV_LOCAL" | tail -n 1 | cut -d= -f2- | tr -d '\r')"
  fi
fi
if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ 缺少 PRIVATE_KEY（可通过环境变量或 frontend/.env.local 提供）"
  echo "   例：export PRIVATE_KEY=0x..."
  exit 1
fi
cd "$ROOT_DIR/contracts" || exit 1
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
cd ..

# 第四步：启动 VRF 自动触发
echo "🎲 启动 VRF 自动触发..."
cd "$ROOT_DIR/frontend" || exit 1
RPC_URL="$RPC_URL" PRIVATE_KEY="$PRIVATE_KEY" node scripts/autoFulfill.mjs &
echo "✅ AutoFulfill 启动"

echo ""
echo "✅ 环境就绪！接下来："
echo "   1. 在 MetaMask 重置所有测试账户（Settings → Advanced → Reset Account）"
echo "   2. 运行前端：cd frontend && npm run dev"
