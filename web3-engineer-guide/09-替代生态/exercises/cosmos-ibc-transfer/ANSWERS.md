# IBC 思考题答案

## Q1：channel 关闭后，已经在 chainB 上的 voucher 还能 transfer 回去吗？

不能。ICS-20 的 voucher 在 chainB 上其实只是一个被 mint 出来的 IBC token，要把它"销毁并解锁原生 stake"，
必须通过同一个 channel 发回 chainA。channel 一旦 closed，对应的 packet flow 就断了；
voucher 在 chainB 上变成"孤儿资产"——形式上还在，但失去了与原生资产的桥接。
工程实践：因此 channel close 是非常严肃的操作，社区一般通过 governance 谨慎执行。

## Q2：如果 relayer 一直不 relay packet ack，最终会怎样？

发起方（chainA）锁定的资产会一直 escrow 在 ICS-20 模块账户，无法被 alice 取回；
等到 packet timeout（绝对高度或绝对时间）到达，任意人可以提交 `MsgTimeoutPacket`（带证明）触发退款。
这就是 IBC 的"vault unlock by timeout"。如果 relayer 既不 relay 成功 ack 也不 relay timeout，
资产就会一直锁着——因此 IBC 网络的活性依赖至少存在一个诚实 relayer，
这是 trust-minimized 而不是 trust-less 的核心区别。

## Q3：IBC 是 trust-minimized 的——它信任谁？

只信任两条链各自的 **共识**（具体说，是 light client 验证算法）。
IBC 的 light client 在 chainA 上跑 chainB 的轻客户端逻辑（验签 + Merkle proof），反之亦然。
它不信任 relayer（relayer 只是搬运 packet 数据 + proof，proof 是链上验证的）。
但它**信任 chainA / chainB 自己的安全假设**：
如果 chainB 的 ⅔ 验证人作恶，IBC 在 chainA 那边的 light client 也会接受错误状态。
这就是为什么 Interchain Security（ICS / replicated security）出现：让小链共享 Cosmos Hub 的验证人集合。
