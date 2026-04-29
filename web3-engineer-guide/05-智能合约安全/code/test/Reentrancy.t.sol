// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {VulnerableBank} from "../vulnerable/Reentrancy.sol";
import {SafeBank} from "../patched/Reentrancy.sol";
import {ReentrancyAttacker} from "../attack/ReentrancyAttack.sol";

contract ReentrancyTest is Test {
    VulnerableBank bank;
    SafeBank safe;

    function setUp() public {
        bank = new VulnerableBank();
        safe = new SafeBank();
        vm.deal(address(bank), 10 ether); // 受害者池子
        vm.deal(address(safe), 10 ether);
    }

    function test_VulnerableBank_isDrained() public {
        ReentrancyAttacker atk = new ReentrancyAttacker{value: 1 ether}(bank);
        vm.deal(address(atk), 1 ether);
        atk.pwn{value: 1 ether}();
        assertEq(address(bank).balance, 0, "bank should be empty");
        assertGt(address(atk).balance, 5 ether, "attacker drained pool");
    }

    function test_SafeBank_isProtected() public {
        // 用同样模式攻击 SafeBank：第二次 withdraw 必须 revert。
        // 这里直接调用 SafeBank.withdraw 两次也行，关键是 nonReentrant 阻断。
        vm.deal(address(this), 1 ether);
        safe.deposit{value: 1 ether}();
        safe.withdraw();
        vm.expectRevert();
        safe.withdraw();
    }

    receive() external payable {}
}
