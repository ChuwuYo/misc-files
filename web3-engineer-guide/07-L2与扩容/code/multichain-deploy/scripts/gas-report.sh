#!/usr/bin/env bash
# 从 out/deploys/*.log 抽取 gas 数字，生成 gas-report.md
set -euo pipefail

REPORT="gas-report.md"
echo "# 多链 gas 对比（自动生成）" > "$REPORT"
echo "" >> "$REPORT"
echo "| Chain | Deploy gas | Tx gas (increment) | Notes |" >> "$REPORT"
echo "|---|---:|---:|---|" >> "$REPORT"

for log in out/deploys/*.log; do
  chain=$(basename "$log" .log)
  deploy_gas=$(grep -E "gas used:" "$log" | head -1 | awk '{print $NF}' || echo "?")
  tx_gas=$(grep -E "gas used:" "$log" | sed -n '2p' | awk '{print $NF}' || echo "?")
  echo "| $chain | $deploy_gas | $tx_gas |  |" >> "$REPORT"
done

echo "" >> "$REPORT"
echo "> 数据由 deploy-all.sh 在测试网跑出，每次结果略有波动。" >> "$REPORT"
echo "Generated: $REPORT"
cat "$REPORT"
