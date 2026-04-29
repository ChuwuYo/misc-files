#!/usr/bin/env bash
# 启动 4 验证者本地 cometbft 测试网（kvstore 应用）
# 验证版本：cometbft v0.38.x（写作日 2026-04-27）
# 安装：
#   macOS:  brew install cometbft        # 或
#   通用:   go install github.com/cometbft/cometbft/cmd/cometbft@v0.38.12
#
# 用法：
#   bash cometbft_testnet.sh init      # 生成 4 节点目录
#   bash cometbft_testnet.sh start     # 在 4 个 tmux 窗口里启动
#   bash cometbft_testnet.sh tx "k1=v1"
#   bash cometbft_testnet.sh stop
set -euo pipefail

ROOT="${ROOT:-$HOME/.cometbft-testnet}"
N=4

cmd=${1:-help}
case "$cmd" in
  init)
    rm -rf "$ROOT"
    cometbft testnet --v $N --o "$ROOT" --populate-persistent-peers \
      --starting-ip-address 127.0.0.1
    # 修改各节点端口避免冲突
    for i in $(seq 0 $((N-1))); do
      cfg="$ROOT/node$i/config/config.toml"
      p2p=$((26656 + i*2))
      rpc=$((26657 + i*2))
      sed -i.bak \
        -e "s|^laddr = \"tcp://0.0.0.0:26656\"|laddr = \"tcp://127.0.0.1:${p2p}\"|" \
        -e "s|^laddr = \"tcp://127.0.0.1:26657\"|laddr = \"tcp://127.0.0.1:${rpc}\"|" \
        -e "s|^addr_book_strict = true|addr_book_strict = false|" \
        -e "s|^allow_duplicate_ip = false|allow_duplicate_ip = true|" \
        "$cfg"
      # 重写 persistent_peers 端口
      python3 - "$cfg" "$N" "$i" <<'PY'
import re, sys
cfg, n, me = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
with open(cfg) as f: txt = f.read()
def fix(m):
    peers = m.group(1).split(",")
    out = []
    for p in peers:
        if not p.strip(): continue
        nodeid, addr = p.split("@")
        ip, port = addr.split(":")
        # 推算这个 peer 是 node 几（基于原顺序）
        # cometbft testnet 默认按节点序生成，用替换法逐个映射
        out.append(p)
    return 'persistent_peers = "%s"' % ",".join(out)
# 简化：用脚本模式不做映射，只把端口 26656+i*2 写进去
new_peers = []
for j in range(n):
    if j == me: continue
    # 读 node{j} 的 nodeid
    import subprocess, os
    node_dir = os.path.join(os.path.dirname(os.path.dirname(cfg)), "..", f"node{j}")
    nid = subprocess.check_output(["cometbft", "show-node-id", "--home", node_dir]).decode().strip()
    new_peers.append(f"{nid}@127.0.0.1:{26656 + j*2}")
txt = re.sub(r'persistent_peers = ".*"', f'persistent_peers = "{",".join(new_peers)}"', txt)
with open(cfg, "w") as f: f.write(txt)
PY
    done
    echo "[ok] 4 节点已初始化于 $ROOT"
    ;;
  start)
    command -v tmux >/dev/null || { echo "需要 tmux"; exit 1; }
    tmux new-session -d -s comet -n n0 \
      "cometbft node --home $ROOT/node0 --proxy_app=kvstore"
    for i in 1 2 3; do
      tmux new-window -t comet -n n$i \
        "cometbft node --home $ROOT/node$i --proxy_app=kvstore"
    done
    echo "[ok] 已在 tmux 会话 'comet' 启动 4 节点。tmux attach -t comet 查看。"
    ;;
  tx)
    payload=${2:-"k=$(date +%s)"}
    # 发到 node0 的 RPC
    curl -s "http://127.0.0.1:26657/broadcast_tx_commit?tx=\"$payload\"" | head -c 400
    echo
    ;;
  status)
    for i in 0 1 2 3; do
      port=$((26657 + i*2))
      h=$(curl -s "http://127.0.0.1:$port/status" | python3 -c \
        'import sys,json;print(json.load(sys.stdin)["result"]["sync_info"]["latest_block_height"])')
      echo "node$i height=$h"
    done
    ;;
  stop)
    tmux kill-session -t comet 2>/dev/null || true
    echo "[ok] stopped"
    ;;
  *)
    echo "用法: bash cometbft_testnet.sh {init|start|tx [payload]|status|stop}"
    ;;
esac
