# 练习 01 — 给一段 EVM 字节码逆向出 Solidity 函数选择器

## 题目

下面是一段 deployed bytecode（runtime code，已经去掉 constructor 部分）：

```
0x6080604052348015600f57600080fd5b50600436106032576000357c01000000000000
00000000000000000000000000000000000000000000900480632e64cec11460375780
636057361d146052575b600080fd5b603e6079565b604051808281526020019150506040
5180910390f35b6077600480360360208110156065576000fd5b81019080803590602001
9092919050505060829056
```

**问题**：

1. 这段字节码暴露了几个 public 函数？
2. 各自的 4-byte selector 是什么？
3. 选择器对应的函数签名（用 `cast 4byte` 查）是什么？
4. 重写出对应的 Solidity 源代码。

不要用 Etherscan 的 "Decompile" 功能；自己用 [evm.codes/playground](https://www.evm.codes/playground) 或纸笔模拟 EVM。

---

## 解答

### 第 1 步：识别 dispatcher

在字节码里搜两个最关键的模式：`80 63 ?? ?? ?? ?? 14 ?? JUMPI`。这是 Solidity 标准 dispatcher 的"DUP1 + PUSH4 selector + EQ + JUMPI"组合。

把字节码插空格分组（`evm.codes` 的 disassembler 会自动分）：

```
60 80               PUSH1 0x80
60 40               PUSH1 0x40
52                  MSTORE
34                  CALLVALUE
80                  DUP1
15                  ISZERO
60 0f               PUSH1 0x0f
57                  JUMPI
60 00               PUSH1 0x00
80                  DUP1
fd                  REVERT
5b                  JUMPDEST [0x0f]
50                  POP
60 04               PUSH1 0x04
36                  CALLDATASIZE
10                  LT
60 32               PUSH1 0x32
57                  JUMPI
60 00               PUSH1 0x00
35                  CALLDATALOAD
7c 01000000...      PUSH29 0x01000000... (用来除以 2^224)
90                  SWAP1
04                  DIV
80                  DUP1
63 2e64cec1         PUSH4 0x2e64cec1   ; <—— selector #1
14                  EQ
60 37               PUSH1 0x37
57                  JUMPI
80                  DUP1
63 6057361d         PUSH4 0x6057361d   ; <—— selector #2
14                  EQ
60 52               PUSH1 0x52
57                  JUMPI
5b                  JUMPDEST [0x32]
60 00               PUSH1 0x00
80                  DUP1
fd                  REVERT
...
```

> 这段使用了"PUSH29 + DIV"提取 selector 的写法（早期 Solidity 0.4.x），等价于今天的 `PUSH1 0xe0; SHR`。看到 PUSH29 后跟 DIV 就要意识到"这是 Solidity 0.4.x 的产物"。

### 第 2 步：列出 selector

两个 selector：

- `0x2e64cec1`
- `0x6057361d`

### 第 3 步：反查签名

```bash
cast 4byte 0x2e64cec1
# → retrieve()

cast 4byte 0x6057361d
# → store(uint256)
```

### 第 4 步：跟进函数体

**0x37: retrieve()**

```
5b                JUMPDEST
60 3e             PUSH1 0x3e
60 79             PUSH1 0x79
56                JUMP            ; 跳到 0x79
5b                JUMPDEST [0x3e]
60 40             PUSH1 0x40
51                MLOAD
80                DUP1
82                DUP3
81                DUP2
52                MSTORE          ; 把返回值写进 memory
60 20             PUSH1 0x20
01                ADD
91                SWAP2
50                POP
50                POP
60 40             PUSH1 0x40
51                MLOAD
80                DUP1
91                SWAP2
03                SUB
90                SWAP1
f3                RETURN
5b                JUMPDEST [0x79]
60 00             PUSH1 0x00
80                DUP1
54                SLOAD           ; 从 storage[0] 读值
90                SWAP1
50                POP
90                SWAP1
56                JUMP
```

含义：`return SLOAD(0)`。

**0x52: store(uint256)**

```
5b                JUMPDEST
60 77             PUSH1 0x77
60 04             PUSH1 0x04
80                DUP1
36                CALLDATASIZE
03                SUB
60 20             PUSH1 0x20
81                DUP2
10                LT
15 65             PUSH1 0x65
57                JUMPI           ; 长度不够 32 字节就 revert
60 00             PUSH1 0x00
fd                REVERT
5b                JUMPDEST [0x65]
81                DUP2
01                ADD
90                SWAP1
80                DUP1
80                DUP1
35                CALLDATALOAD    ; 取参数
90                SWAP1
60 20             PUSH1 0x20
01                ADD
90                SWAP1
92                SWAP3
91                SWAP2
90                SWAP1
50                POP
50                POP
50                POP
60 82             PUSH1 0x82
56                JUMP            ; 跳到 0x82
5b                JUMPDEST [0x82]
80                DUP1
60 00             PUSH1 0x00
81                DUP2
90                SWAP1
55                SSTORE          ; storage[0] = num
50                POP
56                JUMP
```

含义：`SSTORE(0, num)`。

### 第 5 步：还原 Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.4.24; // 注意：这段是 0.4.x 编译产物（PUSH29+DIV）

contract Storage {
    uint256 number;

    function store(uint256 num) public {
        number = num;
    }

    function retrieve() public view returns (uint256) {
        return number;
    }
}
```

这就是 Remix IDE 的 1.sol 模板，最常被部署的合约之一。

---

## 拓展

- 用 [Heimdall-rs](https://github.com/Jon-Becker/heimdall-rs) `heimdall decompile` 自动反编译，把你的手工结果对照
- 让 Claude 用 §19.3 的"PC by PC + stack"格式逐 PC 模拟一遍
- 把这段字节码部署到本地 anvil，跑 `cast call` 验证 store/retrieve 行为

完成后请回到 [README §13 ABI 与函数选择器深入](../README.md#13-abi-与函数选择器深入) 巩固。
