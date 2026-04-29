// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import {SimpleERC3643} from "./SimpleERC3643.sol";

contract SimpleERC3643Test is Test {
    SimpleERC3643 token;
    address agent = address(0xA9E1);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address charlie = address(0xC); // 未 verified

    function setUp() public {
        token = new SimpleERC3643("KYC Token", "KYCT", agent);
        vm.startPrank(agent);
        token.setVerified(alice, true);
        token.setVerified(bob, true);
        token.mint(alice, 1000 ether);
        vm.stopPrank();
    }

    function test_VerifiedToVerified_Succeeds() public {
        vm.prank(alice);
        token.transfer(bob, 100 ether);
        assertEq(token.balanceOf(bob), 100 ether);
    }

    function test_TransferToNonVerified_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SimpleERC3643.NotVerified.selector, charlie));
        token.transfer(charlie, 100 ether);
    }

    function test_FrozenSenderCannotTransfer() public {
        vm.prank(agent);
        token.setFrozen(alice, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SimpleERC3643.AccountFrozen.selector, alice));
        token.transfer(bob, 100 ether);
    }

    function test_PausedBlocksAll() public {
        vm.prank(agent);
        token.setPaused(true);

        vm.prank(alice);
        vm.expectRevert(SimpleERC3643.TokenPaused.selector);
        token.transfer(bob, 100 ether);
    }

    function test_ForcedTransfer_BypassesFrozen() public {
        vm.prank(agent);
        token.setFrozen(alice, true);

        // 强制转账即便 alice 被 frozen 也成功（监管命令）
        vm.prank(agent);
        token.forcedTransfer(alice, bob, 100 ether);
        assertEq(token.balanceOf(bob), 100 ether);
    }

    function test_OnlyAgentCanSetVerified() public {
        vm.prank(alice);
        vm.expectRevert(SimpleERC3643.NotAgent.selector);
        token.setVerified(charlie, true);
    }
}
