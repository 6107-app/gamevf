#!/bin/bash

echo "🚀 启动开发环境..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
PRIVATE_KEY="${PRIVATE_KEY:-}"

ENV_FILE="$ROOT_DIR/frontend/.env.local"
DEPLOY_DIR="$ROOT_DIR/contracts/deployments"
DEPLOY_FILE="$DEPLOY_DIR/localhost.json"

mkdir -p "$DEPLOY_DIR"

# ─────────────────────────────────────────────
# 第一步：启动 Anvil（安全模式）
# ─────────────────────────────────────────────
echo "⛏️ 启动 Anvil..."

ANVIL_PORT="$(echo "$RPC_URL" | awk -F: '{print $NF}')"

EXISTING_PID="$(lsof -nP -iTCP:"$ANVIL_PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1)"

if [ -n "$EXISTING_PID" ]; then
  echo "✅ Anvil 已在运行 (PID: $EXISTING_PID)"
else

  # ⚠️ 关键修复：只有文件存在才 load-state
  if [ -f "$ROOT_DIR/anvil-state.json" ]; then
    echo "📦 检测到 state 文件，加载历史链状态"
    ANVIL_CMD="anvil --load-state $ROOT_DIR/anvil-state.json"
  else
    echo "📦 未检测到 state 文件，启动全新链"
    ANVIL_CMD="anvil"
  fi

  $ANVIL_CMD \
    --dump-state "$ROOT_DIR/anvil-state.json" \
    --chain-id 31337 \
    --host 0.0.0.0 \
    --port "$ANVIL_PORT" &

  ANVIL_PID=$!
  echo "✅ Anvil 启动 (PID: $ANVIL_PID)"
fi

# ─────────────────────────────────────────────
# 等待 RPC ready（比 sleep 可靠）
# ─────────────────────────────────────────────
echo "⏳ 等待 RPC 启动..."

until curl -s "$RPC_URL" > /dev/null; do
  sleep 1
done

echo "✅ RPC 已就绪"

# ─────────────────────────────────────────────
# 第二步：同步区块
# ─────────────────────────────────────────────
echo "⛏️ 同步区块高度..."
cast rpc anvil_mine 20 --rpc-url "$RPC_URL" > /dev/null

# ─────────────────────────────────────────────
# 第三步：读取 PRIVATE_KEY
# ─────────────────────────────────────────────
echo "🔑 读取 PRIVATE_KEY..."

if [ -z "$PRIVATE_KEY" ]; then
  if [ -f "$ENV_FILE" ]; then
    PRIVATE_KEY="$(
      grep -E '^PRIVATE_KEY=' "$ENV_FILE" \
      | tail -n 1 \
      | cut -d= -f2- \
      | tr -d '\r'
    )"
  fi
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ 缺少 PRIVATE_KEY"
  exit 1
fi

# ─────────────────────────────────────────────
# 第四步：部署合约
# ─────────────────────────────────────────────
echo "📦 部署合约..."

cd "$ROOT_DIR/contracts" || exit 1

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast

cd ..

# ─────────────────────────────────────────────
# 第五步：检查 deployment
# ─────────────────────────────────────────────
echo "📝 检查 deployment 文件..."

if [ ! -f "$DEPLOY_FILE" ]; then
  echo "❌ deployment 文件不存在: $DEPLOY_FILE"
  exit 1
fi

# ─────────────────────────────────────────────
# 第六步：读取地址（加容错）
# ─────────────────────────────────────────────
GAME_ADDRESS="$(jq -r '.GAME_ADDRESS // empty' "$DEPLOY_FILE")"
ROD_ADDRESS="$(jq -r '.ROD_ADDRESS // empty' "$DEPLOY_FILE")"
VRF_ADDRESS="$(jq -r '.VRF_ADDRESS // empty' "$DEPLOY_FILE")"

if [ -z "$GAME_ADDRESS" ]; then
  echo "❌ GAME_ADDRESS 读取失败"
  exit 1
fi

# ─────────────────────────────────────────────
# 第七步：更新 frontend env
# ─────────────────────────────────────────────
echo "📝 更新 frontend/.env.local..."

touch "$ENV_FILE"

sed -i.bak '/^PRIVATE_KEY=/d' "$ENV_FILE"
sed -i.bak '/^VRF_ADDRESS=/d' "$ENV_FILE"
sed -i.bak '/^NEXT_PUBLIC_GAME_ADDRESS=/d' "$ENV_FILE"
sed -i.bak '/^NEXT_PUBLIC_ROD_ADDRESS=/d' "$ENV_FILE"

cat >> "$ENV_FILE" <<EOF
PRIVATE_KEY=$PRIVATE_KEY
VRF_ADDRESS=$VRF_ADDRESS
NEXT_PUBLIC_GAME_ADDRESS=$GAME_ADDRESS
NEXT_PUBLIC_ROD_ADDRESS=$ROD_ADDRESS
EOF

echo "✅ .env.local 已更新"
echo "🎮 GAME_ADDRESS=$GAME_ADDRESS"
echo "🎣 ROD_ADDRESS=$ROD_ADDRESS"

# ─────────────────────────────────────────────
# 第八步：重启 AutoFulfill
# ─────────────────────────────────────────────
echo "🛑 清理旧 AutoFulfill 进程..."

pkill -f "autoFulfill.mjs" 2>/dev/null || true
sleep 1

echo "🎲 启动 VRF 自动触发..."

cd "$ROOT_DIR/frontend" || exit 1

RPC_URL="$RPC_URL" PRIVATE_KEY="$PRIVATE_KEY" \
node scripts/autoFulfill.mjs &

echo "✅ AutoFulfill 启动"

# ─────────────────────────────────────────────
# 完成
# ─────────────────────────────────────────────
echo ""
echo "✅ 环境就绪！"
echo ""
echo "1. MetaMask -> Settings -> Advanced -> Reset Account"
echo "2. cd frontend && npm run dev"