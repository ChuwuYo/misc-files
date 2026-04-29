#!/usr/bin/env bash
# 把 Counter 部署到 5 条测试网，输出 deploy receipts
# 务必先 cp .env.example .env 并填入测试钱包私钥与 RPC

set -euo pipefail
[[ -f .env ]] || { echo ".env 不存在，先 cp .env.example .env"; exit 1; }
# shellcheck disable=SC1091
source .env

mkdir -p out/deploys

deploy() {
  local name="$1"
  local rpc="$2"
  echo "==> Deploying to $name"
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$rpc" \
    --broadcast \
    --slow \
    -vvv 2>&1 | tee "out/deploys/$name.log"
}

deploy "sepolia"        "$SEPOLIA_RPC"
deploy "op-sepolia"     "$OP_SEPOLIA_RPC"
deploy "base-sepolia"   "$BASE_SEPOLIA_RPC"
deploy "scroll-sepolia" "$SCROLL_SEPOLIA_RPC"

# zkSync 需要单独的 foundry-zksync
if command -v forge-zksync >/dev/null 2>&1; then
  echo "==> Deploying to zksync-sepolia (zksync-foundry)"
  forge-zksync script script/Deploy.s.sol:Deploy \
    --rpc-url "$ZKSYNC_SEPOLIA_RPC" \
    --broadcast --zksync \
    -vvv 2>&1 | tee out/deploys/zksync-sepolia.log
else
  echo "[skip] forge-zksync 未安装，跳过 zkSync Sepolia"
fi

echo "Done. logs in out/deploys/"
