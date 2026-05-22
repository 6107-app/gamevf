#!/bin/bash
echo "🚀 启动开发环境..."

# 第一步：启动 Anvil
echo "⛏️  启动 Anvil..."
anvil --dump-state /Users/elebear/Documents/GitHub/gamevf/anvil-state.json &
ANVIL_PID=$!
echo "✅ Anvil 启动 (PID: $ANVIL_PID)"

# 等待 Anvil 就绪
sleep 3

# 第二步：挖矿让区块高度超过 MetaMask 缓存
echo "⛏️  同步区块高度..."
cast rpc anvil_mine 110 --rpc-url http://127.0.0.1:8545

# 第三步：部署合约
echo "📦 部署合约..."
cd /Users/elebear/Documents/GitHub/gamevf/contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
cd ..

# 第四步：启动 VRF 自动触发
echo "🎲 启动 VRF 自动触发..."
node /Users/elebear/Documents/GitHub/gamevf/frontend/scripts/autoFulfill.mjs &
echo "✅ AutoFulfill 启动"

echo ""
echo "✅ 环境就绪！接下来："
echo "   1. 在 MetaMask 重置所有测试账户（Settings → Advanced → Reset Account）"
echo "   2. 运行前端：cd frontend && npm run dev"
