// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Liquidator, IAggregatorV3} from "../src/Liquidator.sol";

/// @notice 教学占位测试。完整 fork 测试请参考 README.md，
/// 需要 forge install aave-v3-core + uniswap v3-periphery + chainlink。
contract LiquidatorTest is Test {
    Liquidator internal liq;

    function setUp() public {
        // 假地址，仅用于编译/部署烟雾测试
        liq = new Liquidator(address(0xAAA1), address(0xBBB2));
    }

    function test_Deploy() public view {
        assertEq(liq.owner(), address(this));
        assertEq(liq.PRICE_STALE_THRESHOLD(), 3600);
    }
}
