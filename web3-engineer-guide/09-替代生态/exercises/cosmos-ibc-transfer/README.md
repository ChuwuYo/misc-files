# 练习 2：用 IBC 把 token 从 chainA 转到 chainB

## 目标

用 Ignite + hermes/rly 在两条本地链之间打开一个 IBC channel，
把 chainA 的 `stake` denom 转到 chainB，观察 ICS-20 packet 的全过程。

## 步骤

```bash
# 1. 起两条链
ignite scaffold chain github.com/example/chainA --no-module
ignite scaffold chain github.com/example/chainB --no-module
(cd chainA && ignite chain serve --config ../configs/a.yml &)
(cd chainB && ignite chain serve --config ../configs/b.yml &)
```

`configs/a.yml` 把 chainA 的 RPC/grpc/api 端口改成 26657/9090/1317，
`configs/b.yml` 改成 26757/9190/1417，避免冲突。

```bash
# 2. 安装 hermes（cosmos relayer）
cargo install ibc-relayer-cli --bin hermes --locked

# 3. 给 hermes 写 config.toml（chainA, chainB），导入 keys
hermes keys add --chain chainA --mnemonic-file ./alice.mnemonic
hermes keys add --chain chainB --mnemonic-file ./alice.mnemonic

# 4. 建 client → connection → channel
hermes create channel --a-chain chainA --b-chain chainB \
  --a-port transfer --b-port transfer --new-client-connection

# 5. 起 relayer
hermes start &

# 6. 在 chainA 发 IBC transfer
chainAd tx ibc-transfer transfer transfer channel-0 \
  $(chainBd keys show alice -a) 1000stake \
  --from alice --chain-id chainA -y

# 7. 在 chainB 查 voucher denom（hash 化后的 ibc/...）
chainBd q bank balances $(chainBd keys show alice -a)
```

## 你应该看到

1. chainA 上的 alice 余额 stake -1000
2. chainB 上的 alice 余额 +1000，但 denom 是 `ibc/<HASH>`，
   通过 `chainBd q ibc-transfer denom-trace <HASH>` 反查得到 `transfer/channel-0/stake`
3. 整个过程中 hermes 日志会打印 `MsgRecvPacket`、`MsgAcknowledgement`

## 思考题（答案见 ANSWERS.md）

- Q1：channel 关闭后，已经在 chainB 上的 voucher 还能 transfer 回去吗？
- Q2：如果 relayer 一直不 relay packet ack，最终会怎样？
- Q3：IBC 是 trust-minimized 的——它信任谁？
