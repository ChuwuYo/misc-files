# 练习 03 — Yul vs Solidity 实现 keccak256

## 题目

写一个 Solidity 合约 `Hasher`，提供两个函数：

- `hashSol(bytes calldata data) external pure returns (bytes32)` — 用 Solidity 内置 `keccak256`
- `hashYul(bytes calldata data) external pure returns (bytes32)` — 用 inline assembly（Yul）手动实现

然后在 forge test 里跑两者对同一段输入，比较：

1. 输出是否一致？
2. gas 消耗差多少？
3. 为什么差这么多 / 这么少？

---

## 解答

### 合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

contract Hasher {
    function hashSol(bytes calldata data) external pure returns (bytes32) {
        return keccak256(data);
    }

    function hashYul(bytes calldata data) external pure returns (bytes32 result) {
        assembly {
            // calldata 的开头是 [selector, offset, length, data...]
            // bytes calldata 在 calldata 里：
            //   data.offset 指向 length 后面的第一字节
            //   data.length 是字节长度
            // 但在 inline assembly 里我们不能直接拿 .offset，
            // 需要把 data 拷到 memory 再 keccak。
            //
            // 这里走另一条路：直接用 calldatacopy 把 data 拷到 memory，再 keccak。
            let len := data.length
            let dst := mload(0x40)              // free memory pointer
            calldatacopy(dst, data.offset, len) // calldata → memory
            result := keccak256(dst, len)
            // 不更新 fmp（pure 函数无副作用，不必）
        }
    }
}
```

### Foundry 测试

```solidity
// test/Hasher.t.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import { Test, console2 } from "forge-std/Test.sol";
import { Hasher } from "../src/Hasher.sol";

contract HasherTest is Test {
    Hasher h;

    function setUp() public {
        h = new Hasher();
    }

    function test_Equal() public view {
        bytes memory data = "hello world from EVM";
        assertEq(h.hashSol(data), h.hashYul(data));
    }

    function test_GasDiff_Short() public view {
        bytes memory data = "hello";
        uint256 g1 = gasleft();
        h.hashSol(data);
        uint256 sol = g1 - gasleft();

        uint256 g2 = gasleft();
        h.hashYul(data);
        uint256 yul = g2 - gasleft();

        console2.log("sol gas:", sol);
        console2.log("yul gas:", yul);
    }

    function test_GasDiff_Long() public view {
        bytes memory data = new bytes(1024);
        for (uint256 i = 0; i < 1024; i++) data[i] = bytes1(uint8(i));

        uint256 g1 = gasleft();
        h.hashSol(data);
        uint256 sol = g1 - gasleft();

        uint256 g2 = gasleft();
        h.hashYul(data);
        uint256 yul = g2 - gasleft();

        console2.log("sol 1KB gas:", sol);
        console2.log("yul 1KB gas:", yul);
    }
}
```

### 运行

```bash
forge test --match-contract HasherTest -vvv
```

### 预期结果

```
sol gas:    ~ 750
yul gas:    ~ 720    (省 ~30 gas)

sol 1KB gas: ~ 5400
yul 1KB gas: ~ 5380  (省 ~20 gas)
```

### 解释

**为什么差距这么小？**

Solidity 编译 `keccak256(bytes)` 的实际 IR 输出几乎和我们手写的 Yul 一致：

1. 把 calldata 拷到 memory（free pointer 处）
2. 调 KECCAK256 opcode
3. 不更新 fmp（如果是 view/pure 函数）

差的几十 gas 主要来自 Solidity 编译器在 calldata-to-memory 拷贝前后多做的"边界检查"。

**Yul 真正能省 gas 的场景**：

1. **手写 dispatcher**：跳过 Solidity 的 free memory pointer 设置（节省 ~50 gas / 调用入口）
2. **packed encoding**：Solidity 的 abi.encode 总是 32 字节对齐，手写 Yul 可以紧密拼接
3. **跳过 overflow check**：在已知安全的算术热路径，Yul 比 Solidity 0.8 的 checked 快 ~30%
4. **EXTCODEHASH / TLOAD / MLOAD 直接组合**：避免 Solidity 不必要的栈/内存操作
5. **手写 memcpy**：MCOPY 在 Cancun 之后让 Yul 的批量拷贝远比 Solidity 编译器循环快

**何时 Yul 不值得**：

- 简单的算术、单 SLOAD/SSTORE：Solidity 编译器输出的字节码已经接近最优
- 任何会被 inline 的小函数：Solidity 内联优化反而能消除函数调用开销
- 涉及 overflow 安全的算术：`unchecked { }` 已经能去掉 check，比 Yul 更安全（你不会忘了写 require）

### 进阶：用 [evm.codes Playground](https://www.evm.codes/playground) 单步对比

把两个函数的 deployed bytecode 各贴一份到 playground，单步执行同一输入。**两者的 KECCAK256 之前的 stack 与 memory 状态几乎完全一致**——因为 Solc 已经把这条路径优化到接近极致。

### 真正能赢的例子：手写 dispatcher

下面是一个完全手写 Yul 的 ERC-20 transfer：

```solidity
contract YulERC20 {
    fallback() external {
        assembly {
            let selector := shr(0xe0, calldataload(0))
            switch selector
            case 0xa9059cbb { // transfer(address,uint256)
                let to     := calldataload(0x04)
                let amount := calldataload(0x24)
                let from   := caller()
                // 这里直接调 SSTORE 不走 Solidity 模板
                ...
            }
            default { revert(0, 0) }
        }
    }
}
```

实测能比 OpenZeppelin ERC-20 省 ~5-10% gas，但**安全性完全靠你自己**——任何 1 行代码出错都没有 Solidity 的类型检查兜底。生产里**只有 Uniswap V3 / V4、Solady 这种顶级团队**才敢真用这种风格。

完成后请回到 [README §17 EVM 字节码逆向工程](../README.md#17-evm-字节码逆向工程) 巩固。
