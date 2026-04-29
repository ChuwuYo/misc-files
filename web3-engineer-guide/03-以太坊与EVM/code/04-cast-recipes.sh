#!/usr/bin/env bash
# 04 - cast 工具速查 (Foundry v1.0+)
#
# 安装：
#   curl -L https://foundry.paradigm.xyz | bash
#   foundryup            # 默认装 stable v1.0+
#   # 或：foundryup -i nightly
#
# 检查：cast --version 应输出 1.x.y 或 nightly-2026-...
#
# 不要直接 ./04-cast-recipes.sh 跑全部，挑感兴趣的段落复制粘贴。

set -e

# 用任意主网 RPC（你的 alchemy/infura key 替换）
export ETH_RPC_URL=${ETH_RPC_URL:-https://ethereum-rpc.publicnode.com}

VITALIK=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
WETH=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

echo "===== 1. 看链最新区块号 ====="
cast block-number

echo "===== 2. ETH 余额 ====="
cast balance $VITALIK --ether

echo "===== 3. ERC-20 余额 ====="
# 把 18 位精度转成可读
cast call $USDC "balanceOf(address)(uint256)" $VITALIK
cast call $USDC "decimals()(uint8)"

echo "===== 4. 解码 calldata ====="
# 4-byte selector → 函数签名（查 4byte.directory）
cast 4byte 0xa9059cbb
# 解码 calldata（已知 ABI）
cast 4byte-decode 0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045000000000000000000000000000000000000000000000000000000003b9aca00

echo "===== 5. 计算函数选择器 ====="
cast sig "transfer(address,uint256)"
cast sig "balanceOf(address)"
cast sig-event "Transfer(address indexed from, address indexed to, uint256 value)"

echo "===== 6. 估 gas（不发送） ====="
# 模拟 Vitalik 给自己转 1 USDC
cast estimate \
  --from $VITALIK \
  $USDC \
  "transfer(address,uint256)" \
  $VITALIK \
  1000000

echo "===== 7. 解析交易追溯 ====="
# 用一个真实的主网 tx 哈希
TX=0x4d61c79e21b81df9e60f5c6661b289e89a7c4f7d3d4d4f0a4dabc3d62cf42e7e
cast tx $TX
cast receipt $TX
cast run $TX --quick   # 重放 trace（需要 --rpc-url 支持 debug_traceTransaction）

echo "===== 8. 解析 storage slot ====="
# WETH 合约的 totalSupply 在 slot 2（按 ERC-20 模板）
cast storage $WETH 2

echo "===== 9. 计算 keccak / 转换 ====="
cast keccak "Transfer(address,address,uint256)"
cast --to-wei 1 ether
cast --from-wei 1000000000000000000
cast --to-hex 1024
cast --to-dec 0x400
cast --to-bytes32 "hello"

echo "===== 10. EIP-7702 designator 解析 ====="
# Pectra 后，EOA 如果挂了 designator，code 字段是 0xef0100 + 20 字节
# 这里假设知道某个 EOA 已挂 designator
EOA=0xYOUR_DELEGATED_EOA
cast code $EOA
# 取后 20 字节就是 delegate 合约地址

echo "===== 11. 区块 baseFee + blob ====="
cast block latest --json | jq '.baseFeePerGas,.blobGasUsed,.excessBlobGas'

echo "===== 12. 创世账户预言（CREATE2） ====="
# 给定 deployer / salt / initCodeHash 算 CREATE2 地址
cast create2 \
  --deployer 0x0000000000FFe8B47B3e2130213B802212439497 \
  --salt 0x0000000000000000000000000000000000000000000000000000000000000001 \
  --init-code-hash 0xff
