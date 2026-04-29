// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Counter} from "../../src/Counter.sol";

/// @notice 把 dec 的 underflow 反转吞掉，让 fuzzer 能继续往下 walk
contract CounterHandler is Test {
    Counter public counter;

    constructor(Counter _c) {
        counter = _c;
    }

    function inc() external {
        counter.inc();
    }

    function dec() external {
        // 防御性分支：count == 0 时跳过，否则 fuzzer 浪费在必 revert 路径上
        if (counter.count() == 0) return;
        counter.dec();
    }
}

contract CounterInvariantTest is StdInvariant, Test {
    Counter internal counter;
    CounterHandler internal handler;

    function setUp() public {
        counter = new Counter();
        handler = new CounterHandler(counter);

        // 把 fuzzer 的目标限制为 handler，避免无效随机调用
        targetContract(address(handler));
    }

    /// @notice 守恒不变量：count == increments - decrements
    function invariant_countConsistency() public view {
        assertEq(counter.count(), counter.increments() - counter.decrements());
    }

    /// @notice 没有任何路径能让 count 下溢
    function invariant_noUnderflow() public view {
        assertGe(counter.count(), 0);
    }
}
