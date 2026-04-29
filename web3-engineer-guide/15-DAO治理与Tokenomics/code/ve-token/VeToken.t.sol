// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import {VeToken} from "./VeToken.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract VeTokenTest is Test {
    VeToken ve;
    MockToken crv;
    address alice = address(0xA11CE);

    function setUp() public {
        crv = new MockToken();
        ve = new VeToken(address(crv));
        crv.mint(alice, 1000 ether);
    }

    function test_LockMaxGivesFullVote() public {
        vm.startPrank(alice);
        // 锁 4 年（最大）
        ve.createLock(1000 ether, block.timestamp + 4 * 365 days);
        // 应该接近 1000 ether（小幅 WEEK 取整损失）
        uint256 bal = ve.balanceOf(alice);
        assertGt(bal, 990 ether);
        assertLt(bal, 1000 ether);
        vm.stopPrank();
    }

    function test_LockOneYearGivesQuarterVote() public {
        vm.startPrank(alice);
        // 锁 1 年（1y / 4y = 0.25 ve 权重）
        ve.createLock(1000 ether, block.timestamp + 365 days);
        uint256 bal = ve.balanceOf(alice);
        // 1 年 / 4 年 = 0.25
        assertGt(bal, 240 ether);
        assertLt(bal, 260 ether);
        vm.stopPrank();
    }

    function test_DecaysOverTime() public {
        vm.startPrank(alice);
        ve.createLock(1000 ether, block.timestamp + 4 * 365 days);
        uint256 t0 = ve.balanceOf(alice);

        // 推进 2 年
        vm.warp(block.timestamp + 2 * 365 days);
        uint256 t1 = ve.balanceOf(alice);

        // 余额应该减半左右
        assertGt(t0, 2 * t1 - 10 ether);
        assertLt(t0, 2 * t1 + 10 ether);
        vm.stopPrank();
    }

    function test_WithdrawAfterExpiry() public {
        vm.startPrank(alice);
        // 必须严格 > block.timestamp + MIN_LOCK，且会向下取整到 WEEK 边界
        ve.createLock(1000 ether, block.timestamp + 2 weeks);

        vm.warp(block.timestamp + 3 weeks);
        ve.withdraw();
        assertEq(crv.balanceOf(alice), 1000 ether);
        vm.stopPrank();
    }

    function test_CannotShortenLock() public {
        vm.startPrank(alice);
        ve.createLock(1000 ether, block.timestamp + 4 * 365 days);

        vm.expectRevert(bytes("Must increase"));
        ve.increaseUnlockTime(block.timestamp + 1 weeks);
        vm.stopPrank();
    }
}
