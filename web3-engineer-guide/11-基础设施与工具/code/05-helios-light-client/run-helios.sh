#!/usr/bin/env bash
# Helios: 用 untrusted RPC + 已知 beacon checkpoint 验证状态根
# 验证日期: 2026-04, helios v0.8+
set -euo pipefail

if ! command -v helios &>/dev/null; then
  echo "安装 helios:"
  echo "  curl https://raw.githubusercontent.com/a16z/helios/master/heliosup/install | bash"
  echo "  source ~/.bashrc && heliosup"
  exit 1
fi

# 用一个 untrusted execution RPC (Alchemy / Infura), Helios 会校验所有结果
UNTRUSTED_EL_RPC="${UNTRUSTED_EL_RPC:-https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY}"

# Checkpoint 提供方: 使用 ethpandaops 公开 sync URL
# 也可以从信任源 (区块浏览器 / 交易所) 拷贝一个 finalized block_root 作为初始信任根
CHECKPOINT="${CHECKPOINT:-https://sync-mainnet.beaconcha.in}"

# Helios 会暴露一个本地 ETH JSON-RPC, 可作为 wagmi / ethers 的 provider 使用
helios ethereum \
  --network mainnet \
  --consensus-rpc https://www.lightclientdata.org \
  --execution-rpc "${UNTRUSTED_EL_RPC}" \
  --checkpoint "${CHECKPOINT}" \
  --rpc-bind-ip 127.0.0.1 \
  --rpc-port 8545 \
  --data-dir ~/.helios

# 验证: 下面的 RPC 调用结果是经过密码学证明的, 即使 UNTRUSTED_EL_RPC 篡改也会被 Helios 检测出来
# curl -X POST -H "Content-Type: application/json" \
#   -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","latest"],"id":1}' \
#   http://127.0.0.1:8545
