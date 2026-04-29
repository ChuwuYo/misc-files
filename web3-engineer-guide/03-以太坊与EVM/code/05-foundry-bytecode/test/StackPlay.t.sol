// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import { Test, console2 } from "forge-std/Test.sol";
import { StackPlay } from "../src/StackPlay.sol";

contract StackPlayTest is Test {
    StackPlay sp;

    function setUp() public {
        sp = new StackPlay();
    }

    /// `forge test -vvvv --match-test test_BumpTrace`
    /// 关注控制台里的 trace，能看到 SSTORE 的 cold/warm 标记
    function test_BumpTrace() public {
        sp.bump();              // 第一次：cold 0->1，约 22100 gas
        sp.bump();              // 第二次：warm? 不一样，会冷一次因 access list 重置
        assertEq(sp.counter(), 2);
    }

    function test_GasDiff() public {
        uint256 g1 = gasleft();
        sp.bump();              // 0 -> 1
        uint256 first = g1 - gasleft();

        uint256 g2 = gasleft();
        sp.bump();              // 1 -> 2
        uint256 second = g2 - gasleft();

        console2.log("first  bump (0->1, cold) gas:", first);
        console2.log("second bump (1->2, cold) gas:", second);
        // 第一次 22100+，第二次 5000+ 左右
    }

    function test_TransientStorage() public {
        sp.transientPlay();
        assertEq(sp.counter(), 42);
    }

    function test_StateDiff() public {
        vm.startStateDiffRecording();
        sp.bump();
        Vm.AccountAccess[] memory diff = vm.stopAndReturnStateDiff();
        for (uint256 i = 0; i < diff.length; i++) {
            console2.log("kind:", uint8(diff[i].kind));
            console2.log("acct:", diff[i].account);
        }
    }
}
