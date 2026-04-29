#!/usr/bin/env bash
# reth + lighthouse Sepolia 节点初始化脚本
# 验证日期: 2026-04
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "[1/4] 创建数据目录"
mkdir -p "${ROOT}/data/reth" "${ROOT}/data/lighthouse" "${ROOT}/jwt"

echo "[2/4] 生成 JWT secret (engine API 鉴权)"
if [[ ! -f "${ROOT}/jwt/jwt.hex" ]]; then
  openssl rand -hex 32 | tr -d "\n" > "${ROOT}/jwt/jwt.hex"
  chmod 600 "${ROOT}/jwt/jwt.hex"
  echo "    -> 已生成 jwt.hex"
else
  echo "    -> jwt.hex 已存在, 跳过"
fi

echo "[3/4] 检查 Docker"
if ! command -v docker &>/dev/null; then
  echo "缺少 docker, 请先安装 https://docs.docker.com/engine/install/"
  exit 1
fi
docker compose version >/dev/null

echo "[4/4] 启动 reth + lighthouse"
docker compose -f "${ROOT}/docker-compose.yml" up -d

cat <<EOF

启动完成. 常用命令:
  docker compose logs -f reth          # EL 同步进度
  docker compose logs -f lighthouse    # CL 同步进度
  curl -s -X POST -H "Content-Type: application/json" \\
    --data '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' \\
    http://127.0.0.1:8545 | jq         # 检查同步状态
  curl -s http://127.0.0.1:5052/eth/v1/node/syncing | jq
EOF
