# 练习 4：解析一笔真实 Bitcoin Taproot 交易

## 目标

不用任何"高级 SDK 一把梭"，从 raw tx hex 出发：

1. 自己解析 segwit marker / flag、tx version、locktime
2. 对每个 input 判断是 key-path / script-path
3. 对 script-path：解出 control block 中的 `internal pubkey`、`leaf version`、`merkle path`
4. 验证 Schnorr signature（BIP-340）至少在长度 / 编码上合法

## 起点

到 mempool.space / mempool.observer 找一笔 **Ordinals inscription reveal** 交易，把 raw tx hex 拷下来。
推荐选 inscription 因为它一定是 script-path（envelope 用 `OP_FALSE OP_IF "ord" ...`）。

## 验收脚本（你写）

```bash
node decode.mjs <rawhex>
```

输出至少包含：
- txid（双 SHA256，注意 segwit txid 与 wtxid 区别）
- 每个 input 的 spend 类型
- 对 script-path：把 leaf script 反汇编成人类可读 ASM
- 找出 Ordinals envelope 中的 mime-type 与 payload 长度

## 思考题

- Q1：为什么 Bitcoin Core 引入了 wtxid 这一概念？key-path 与 script-path 的 wtxid 差在哪里？
- Q2：control block 中的 merkle path 长度 0..128 字节，为什么是 32 的倍数？最大允许多深的脚本树？
- Q3：BIP-341 用 tagged hash（`SHA256(SHA256(tag) || SHA256(tag) || msg)`），相比直接 SHA256 防御了什么攻击？

## 答案见 ANSWERS.md
