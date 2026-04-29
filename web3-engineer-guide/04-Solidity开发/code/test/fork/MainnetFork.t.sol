// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice 演示 forge fork-test：在主网真实状态上测试合约
/// @dev 跑法：`forge test --match-contract MainnetForkTest --fork-url $MAINNET_RPC_URL --fork-block-number 21000000`
contract MainnetForkTest is Test {
    // 主网 USDC，6 decimals
    IERC20 internal constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    // Circle 国库，长期持仓
    address internal constant USDC_WHALE = 0x55FE002aefF02F77364de339a1292923A15844B8;

    function setUp() public {
        // CI 中无 RPC 时优雅跳过：避免无网络环境下整体测试失败
        try vm.activeFork() returns (uint256) {}
        catch {
            vm.skip(true);
        }
    }

    function test_fork_USDC_metadata() public view {
        // 名称/符号通过低层 staticcall 拿，IERC20 接口未声明 name/symbol
        (bool ok, bytes memory data) = address(USDC).staticcall(abi.encodeWithSignature("symbol()"));
        require(ok, "staticcall symbol failed");
        assertEq(abi.decode(data, (string)), "USDC");
    }

    function test_fork_dealAndTransfer() public {
        address recipient = address(0xBEEF);
        // 用 deal 给鲸鱼地址灌 1000 USDC（fork 上修改 storage）
        deal(address(USDC), USDC_WHALE, 1_000 * 1e6, true);

        vm.prank(USDC_WHALE);
        USDC.transfer(recipient, 500 * 1e6);

        assertEq(USDC.balanceOf(recipient), 500 * 1e6);
    }
}
