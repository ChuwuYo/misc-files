#!/usr/bin/env bash
# One-command dev startup. Uses paths relative to this script so it works
# wherever the repo is cloned.
set -euo pipefail

# Project root = parent of this script's directory.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Make sure bun is reachable even from a non-login shell.
if ! command -v bun >/dev/null 2>&1; then
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
if ! command -v bun >/dev/null 2>&1; then
  echo "✗ bun 未安装。请先运行: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

# Install deps on first run (or after a clean).
if [ ! -d node_modules ]; then
  echo "▸ 安装依赖 (bun install)…"
  bun install
fi

# Self-hosted @imgly model/runtime for offline AI cutout (gitignored).
if [ ! -d public/imgly ]; then
  echo "▸ 同步离线模型资源 (sync:imgly, ~81MB)…"
  node scripts/sync-imgly.mjs
fi

echo "▸ 启动开发服务器 (vite)…"
exec bun run dev
