# 练习 02：50 个状态变量的最优 storage slot 排布

## 题目

下面是一个写得很烂的合约。它有 50 个状态变量、占用了 50 个 slot。
你的任务：在不改变语义的前提下，把它压到尽可能少的 slot，然后用
`forge inspect BadOrder storage-layout` 与 `forge inspect GoodOrder storage-layout`
对比验证。

```solidity
// 反例：每个变量都独占一个 slot
contract BadOrder {
    uint8   a1;  uint256 b1;  uint8   a2;  uint256 b2;
    uint16  c1;  uint256 b3;  uint16  c2;  uint256 b4;
    bool    f1;  uint256 b5;  bool    f2;  uint256 b6;
    address g1;  uint256 b7;  address g2;  uint256 b8;
    uint64  h1;  uint256 b9;  uint64  h2;  uint256 b10;
    uint128 i1;  uint256 b11; uint128 i2;  uint256 b12;
    uint32  j1;  uint256 b13; uint32  j2;  uint256 b14;
    uint8   a3;  uint16  c3;  bool    f3;  address g3;
    uint64  h3;  uint128 i3;  uint32  j3;  uint8   a4;
    uint16  c4;  bool    f4;  address g4;  uint64  h4;
    uint128 i4;  uint32  j4;  uint8   a5;  uint16  c5;
    bool    f5;  address g5;
}
```

## 任务

1. 重写为 `GoodOrder`：把同 slot 可以塞下的字段放在一起；优先把 `address (20)` 与 `uint64/uint96 (8/12)` 配对，把 4 个 `bool` 与 1 个 `uint224` 配对等
2. 提供一份「slot 分配方案」MD 文档，标注每个 slot 内的偏移与字段
3. 写一个测试 `StorageLayoutTest`：
   - 用 `vm.load(addr, slotN)` 读出 BadOrder 与 GoodOrder 的 slot 内容
   - 断言 GoodOrder 的总 slot 数 <= 期望值（评分参考：能打到 12 个以下）

## 关键知识点

- `address` = 20 字节，`uint96` 配 `address` 正好 32 字节
- `bool` = 1 字节（不是 1 bit！），可以塞 32 个进一个 slot
- 结构体字段独立打包；映射、动态数组的「头」也各占一个 slot
- 继承会按父子顺序拼接 storage layout
