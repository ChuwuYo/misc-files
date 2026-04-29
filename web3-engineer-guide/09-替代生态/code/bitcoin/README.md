# Bitcoin: P2TR 交易构造 + LDK Node Lightning demo

两个独立子项目：

```
bitcoin/
├── p2tr/                # bitcoinjs-lib 6.x 构造 / 签名 / 解析 P2TR 交易（key-path & script-path）
└── ldk-node-demo/       # 用 ldk-node 0.4.x 起一个 regtest LN 节点，开通道并发送一笔支付
```

## 通用前置（regtest）

```bash
# 拉起 bitcoind regtest
docker run -d --name btc-regtest \
  -p 18443:18443 -p 18444:18444 -p 28332:28332 -p 28333:28333 \
  -e BITCOIN_RPC_USER=user -e BITCOIN_RPC_PASSWORD=pass \
  ruimarinho/bitcoin-core:25 \
    -regtest -server -rpcallowip=0.0.0.0/0 -rpcbind=0.0.0.0 \
    -txindex -fallbackfee=0.00001 \
    -zmqpubrawblock=tcp://0.0.0.0:28332 \
    -zmqpubrawtx=tcp://0.0.0.0:28333

# 出 200 个块给自己
alias btc='docker exec btc-regtest bitcoin-cli -regtest -rpcuser=user -rpcpassword=pass'
btc createwallet test
addr=$(btc -rpcwallet=test getnewaddress "" bech32m)
btc generatetoaddress 200 $addr
```

## p2tr 子项目

bitcoinjs-lib 6.x（`@noble/curves` 后端）+ 自带 schnorr / taproot 工具。

```bash
cd p2tr
pnpm install
pnpm tsx build_keypath.ts       # 1. key-path P2TR（最常见，等价于 EOA 签名）
pnpm tsx build_scriptpath.ts    # 2. script-path P2TR（一棵 leaf script tree，含 OP_CHECKSIG）
pnpm tsx decode_taproot_tx.ts   # 3. 解析一笔真实 mainnet Taproot 交易
```

## ldk-node-demo 子项目

`ldk-node` 是 LDK 的高层封装（lightningdevkit/ldk-node），自带 sled 持久化 + Esplora chain backend。
脚本演示：起两个节点 A/B，互联，开 100k sats 通道，A → B 发 1000 sats 支付。

```bash
cd ldk-node-demo
pnpm install     # 用 ldk-node 的 napi 绑定（Node 20）
pnpm tsx demo.ts
```

> 如果只看 LDK 原生 Rust API，可以参考官方 `ldk-sample` 与 `ldk-node`/src/builder.rs。
