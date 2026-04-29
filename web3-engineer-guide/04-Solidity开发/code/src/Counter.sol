// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Counter — 用于演示不变量测试的最小合约
/// @notice 不变量：count 永远 >= 0 且 == increments - decrements
contract Counter {
    uint256 public count;
    uint256 public increments;
    uint256 public decrements;

    error Underflow();

    function inc() external {
        unchecked {
            ++count;
            ++increments;
        }
    }

    function dec() external {
        if (count == 0) revert Underflow();
        unchecked {
            --count;
            ++decrements;
        }
    }
}
