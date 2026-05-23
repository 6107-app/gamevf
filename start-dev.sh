#!/bin/bash
set -euo pipefail
echo "🚀 启动开发环境..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
PRIVATE_KEY="${PRIVATE_KEY:-}"

ensure_contract_deps() {
  cd "$ROOT_DIR" || exit 1
  if [ -f "$ROOT_DIR/.gitmodules" ]; then
    if [ ! -d "$ROOT_DIR/contracts/lib/openzeppelin-contracts" ] || [ ! -d "$ROOT_DIR/contracts/lib/chainlink-brownie-contracts" ]; then
      echo "📥 拉取合约依赖（git submodule）..."
      git submodule update --init --recursive
    fi
  fi

  cd "$ROOT_DIR/contracts" || exit 1
  if [ ! -d "$ROOT_DIR/contracts/lib/forge-std" ]; then
    echo "📥 安装 forge-std..."
    forge install foundry-rs/forge-std
  fi
}

ensure_frontend_deps() {
  cd "$ROOT_DIR/frontend" || exit 1
  if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    if [ -f "$ROOT_DIR/frontend/package-lock.json" ]; then
      echo "📦 安装前端依赖（npm ci）..."
      npm ci
    else
      echo "📦 安装前端依赖（npm install）..."
      npm install
    fi
  fi
}

upsert_env() {
  local key="$1"
  local value="$2"
  local file="$3"
  if [ -f "$file" ] && grep -qE "^${key}=" "$file"; then
    perl -pi -e "s|^${key}=.*|${key}=${value}|g" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# 第一步：启动 Anvil
echo "⛏️  启动 Anvil..."
ANVIL_PORT="$(echo "$RPC_URL" | awk -F: '{print $NF}')"
EXISTING_PID="$( (lsof -nP -iTCP:"$ANVIL_PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1) || true )"
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
ensure_contract_deps
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
DEPLOY_LOG="$(mktemp)"
set +e
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast 2>&1 | tee "$DEPLOY_LOG"
FORGE_EXIT_CODE="${PIPESTATUS[0]}"
set -e
if [ "$FORGE_EXIT_CODE" -ne 0 ]; then
  echo "❌ 合约部署失败（forge exit=$FORGE_EXIT_CODE）"
  exit "$FORGE_EXIT_CODE"
fi

VRF_ADDRESS="$(grep -E 'VRF:\s*0x[0-9a-fA-F]{40}' "$DEPLOY_LOG" | tail -n 1 | awk '{print $2}')"
GAME_ADDRESS="$(grep -E 'FishingGame:\s*0x[0-9a-fA-F]{40}' "$DEPLOY_LOG" | tail -n 1 | awk '{print $2}')"
ROD_ADDRESS="$(grep -E 'FishingRod:\s*0x[0-9a-fA-F]{40}' "$DEPLOY_LOG" | tail -n 1 | awk '{print $2}')"

ENV_LOCAL="$ROOT_DIR/frontend/.env.local"
touch "$ENV_LOCAL"
upsert_env "PRIVATE_KEY" "$PRIVATE_KEY" "$ENV_LOCAL"
upsert_env "RPC_URL" "$RPC_URL" "$ENV_LOCAL"
upsert_env "VRF_ADDRESS" "$VRF_ADDRESS" "$ENV_LOCAL"
upsert_env "GAME_ADDRESS" "$GAME_ADDRESS" "$ENV_LOCAL"
upsert_env "ROD_ADDRESS" "$ROD_ADDRESS" "$ENV_LOCAL"
upsert_env "NEXT_PUBLIC_CHAIN_ID" "31337" "$ENV_LOCAL"
upsert_env "NEXT_PUBLIC_RPC_URL" "$RPC_URL" "$ENV_LOCAL"
upsert_env "NEXT_PUBLIC_CONTRACT_ADDRESS" "$GAME_ADDRESS" "$ENV_LOCAL"
upsert_env "NEXT_PUBLIC_FISHING_ROD_ADDRESS" "$ROD_ADDRESS" "$ENV_LOCAL"
cd ..

# 第四步：启动 VRF 自动触发
echo "🎲 启动 VRF 自动触发..."
cd "$ROOT_DIR/frontend" || exit 1
ensure_frontend_deps
RPC_URL="$RPC_URL" PRIVATE_KEY="$PRIVATE_KEY" node scripts/autoFulfill.mjs &
echo "✅ AutoFulfill 启动"

echo ""
echo "✅ 环境就绪！接下来："
echo "   1. 在 MetaMask 重置所有测试账户（Settings → Advanced → Reset Account）"
echo "   2. 运行前端：cd frontend && npm run dev"
