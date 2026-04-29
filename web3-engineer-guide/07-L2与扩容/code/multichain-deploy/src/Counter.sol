// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Counter - 一个最小化的状态变更合约，用于多链 gas 对比
/// @author web3-engineer-guide / 模块 07
/// @notice 故意保持极简：只一个 uint256 + 两个 setter，避免无关因素污染 gas 数据
contract Counter {
    uint256 public number;

    /// @notice 设置一个新值（gas 主要花在 sstore 改写一个非零槽）
    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    /// @notice 自增 1（典型的「读改写」模式）
    /// @dev 在不同 L2 上跑这个函数，能对比出 gas 计价策略的差异
    function increment() public {
        number++;
    }
}
