#!/usr/bin/env bash
# Tenderly: 上传 Foundry 项目源码到监控仪表盘
# 验证日期: 2026-04
set -euo pipefail

if ! command -v tenderly &>/dev/null; then
  echo "缺少 tenderly CLI: npm i -g @tenderly/cli"
  exit 1
fi

# 1. 登录
tenderly login

# 2. 在已有 Foundry 项目根目录初始化
tenderly init

# 3. 推送源码 (会自动 verify, 同 Etherscan)
forge build
tenderly push

# 4. 创建 alerts
tenderly alerts create --config ./tenderly.yaml

# 5. 一键打开仪表盘
tenderly dashboard
