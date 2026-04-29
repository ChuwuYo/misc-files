#!/usr/bin/env bash
# 一键创建 blogchain + blog module。在空目录执行。
set -euo pipefail

if ! command -v ignite >/dev/null 2>&1; then
  echo "Ignite CLI not found. Install via: curl https://get.ignite.com/cli! | bash"
  exit 1
fi

# 1. scaffold 链骨架（不带默认 module，方便后面单独 add）
ignite scaffold chain github.com/example/blogchain --no-module
cd blogchain

# 2. 加 module
ignite scaffold module blog --ibc=false

# 3. 加 list 类型 post（含 CreatePost / UpdatePost / DeletePost / Query 全套）
ignite scaffold list post title body --module blog

# 4. 启动（前台运行；Ctrl-C 停止）
echo "==> chain serve at http://localhost:26657 (tendermint), :1317 (REST), :9090 (gRPC)"
ignite chain serve
