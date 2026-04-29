# Bitcoin Taproot 解析题答案

## Q1：wtxid vs txid

txid（也叫 hash）= 不含 witness 的交易序列化的 double-SHA256。
wtxid = 包含 witness 的完整序列化的 double-SHA256（对 non-segwit tx 二者相等）。

为什么需要 wtxid？因为 SegWit (BIP-141) 把签名移到了 witness 区，
txid 不再覆盖 witness——这刻意是为了**修复 transaction malleability**：
中间人改不动 witness 也无法影响 txid。
但同时，节点之间转发时需要一个能区分"同 txid 但 witness 不同"版本的标识，于是诞生 wtxid。
P2P 层的 `wtxidrelay`（BIP-339）就是基于这个的。

key-path vs script-path：
- key-path：witness = [single 64/65B Schnorr sig] → 体积小，wtxid 与 txid 区别只是 witness 那 64B
- script-path：witness = [..sigs.., script, control_block(33 + 32k B)] → 大得多，
  ord inscription reveal tx 的 witness 经常 100KB+，但 base tx 仍然几百字节，
  所以 wtxid 显著大于 txid 对应的虚拟大小

## Q2：control block 长度 33 + 32k

control block 第一字节 = `leaf_version (7 bits) || parity_bit (1 bit)`，紧跟 32 字节 internal pubkey，
然后是 0..128 个 32B 的 merkle hash（taproot 用 BIP-341 的 tweaked merkle）。

每深一层 merkle 多一个 32B 兄弟节点，所以总长度必然是 33 + 32k，最大 k = 128。
也就是说脚本树最深 128 层 → 单棵树最多 2^128 个 leaves（实际受块大小限制远小于此）。
设计这么深的预算是为了 BitVM/BitVM2 这种"百万脚本叶子"的需求。

## Q3：tagged hash 防御什么

BIP-340 规定 `tagged_hash(tag, msg) = SHA256(SHA256(tag) || SHA256(tag) || msg)`。
两次 prefix 是为了让 tag 占满一整个 SHA256 块（64B），
确保不同 tag 的 hash domain 完全不交叉。

防御对象：**cross-protocol signature replay**。
如果 BIP-340（key-path）和 BIP-341（taproot sighash）都用裸 SHA256，
攻击者有可能构造一个消息，使其在两种语境下都被解读为合法签名输入，
做"在 X 上签的实际是 Y"攻击。
tagged hash 把 tag = `"BIP0340/challenge"` / `"TapSighash"` / `"TapTweak"` 等编进 hash，
让任何混用语境的消息无法碰撞。
