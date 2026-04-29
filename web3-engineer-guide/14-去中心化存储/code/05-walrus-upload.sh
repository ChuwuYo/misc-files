#!/usr/bin/env bash
# 05-walrus-upload.sh
# 演示：上传文件到 Walrus（Sui 团队的去中心化存储）。
#
# 前置：
#   1. 安装 sui CLI: https://docs.sui.io/guides/developer/getting-started/sui-install
#   2. 安装 walrus client: https://docs.walrus.site/usage/setup.html
#   3. 配置 sui client（mainnet 或 testnet），账户有 SUI 和 WAL 余额
#
# 运行：./05-walrus-upload.sh <filepath> [epochs]

set -e

FILE="${1:-./sample.txt}"
EPOCHS="${2:-10}"

if [[ ! -f "$FILE" ]]; then
  echo "❌ 文件不存在: $FILE"
  exit 1
fi

if ! command -v walrus &> /dev/null; then
  echo "❌ walrus CLI 未安装，参考 https://docs.walrus.site/usage/setup.html"
  exit 1
fi

echo "上传 $FILE 到 Walrus，存储 $EPOCHS 个 epoch..."
walrus store "$FILE" --epochs "$EPOCHS" | tee /tmp/walrus-receipt.txt

# 提取 Blob ID
BLOB_ID=$(grep -oE '0x[0-9a-fA-F]+' /tmp/walrus-receipt.txt | head -1)

echo ""
echo "--- 上传完成 ---"
echo "Blob ID: $BLOB_ID"
echo "HTTP 网关 (mainnet):"
echo "  https://aggregator.walrus-mainnet.walrus.space/v1/blobs/$BLOB_ID"
echo ""
echo "本地读回测试："
echo "  walrus read $BLOB_ID --out /tmp/walrus-output"
