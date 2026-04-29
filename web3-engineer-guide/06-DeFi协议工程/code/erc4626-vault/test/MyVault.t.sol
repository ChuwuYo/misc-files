// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MyVault} from "../src/MyVault.sol";

contract MockAsset is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MyVaultTest is Test {
    MockAsset internal asset;
    MyVault internal vault;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal attacker = address(0xBAD);

    function setUp() public {
        asset = new MockAsset();
        vault = new MyVault(IERC20(address(asset)));

        asset.mint(alice, 1_000_000 ether);
        asset.mint(bob, 1_000_000 ether);
        asset.mint(attacker, 1_000_000 ether);
    }

    /// @notice 标准 deposit + 取回。
    function test_DepositAndWithdraw() public {
        vm.startPrank(alice);
        asset.approve(address(vault), 100 ether);
        uint256 shares = vault.deposit(100 ether, alice);
        vm.stopPrank();

        // 因为 offset=6，alice 拿到的 share = assets * 10**6 (大约)
        assertEq(shares, 100 ether * 1e6, "share count off");
        assertEq(vault.totalAssets(), 100 ether);
        assertEq(vault.balanceOf(alice), shares);

        vm.prank(alice);
        uint256 redeemed = vault.redeem(shares, alice, alice);
        assertEq(redeemed, 100 ether, "round trip lost assets");
    }

    /// @notice Inflation attack 防御测试：
    /// 1. 攻击者首先 deposit 1 wei
    /// 2. 攻击者向 vault 直接 transfer 大额（"donate"）让 1 share 价格虚高
    /// 3. 受害者 deposit 一个看似合理的金额（比如 1 ether）
    /// 4. 攻击者 redeem 自己的 1 share，看能否窃取受害者本金
    ///
    /// 在 offset=0 的 vault 上，受害者会损失大部分资金；在 offset=6 上，攻击成本被放大 1e6 倍。
    function test_InflationAttackDefense() public {
        // 1. 攻击者 deposit 最小 1 wei
        vm.startPrank(attacker);
        asset.approve(address(vault), 1);
        uint256 attackerShares = vault.deposit(1, attacker);
        vm.stopPrank();

        assertEq(attackerShares, 1e6, "first deposit shares wrong");

        // 2. 攻击者 donate 1 ether 给 vault（直接 transfer，不走 deposit）
        //    在 offset=0 vault 上，这 1 ether 会被攻击者那 1 share 独占；
        //    在 offset=6 vault 上，virtual shares 让攻击者无法独占。
        vm.prank(attacker);
        asset.transfer(address(vault), 1 ether);

        // 3. 受害者 deposit 1 ether
        vm.startPrank(alice);
        asset.approve(address(vault), 1 ether);
        uint256 aliceShares = vault.deposit(1 ether, alice);
        vm.stopPrank();

        // 受害者必须拿到非零 share
        assertGt(aliceShares, 0, "victim got zero shares: attack succeeded");

        // 4. 攻击者 redeem 1 share，看能拿走多少
        vm.prank(attacker);
        uint256 stolen = vault.redeem(attackerShares, attacker, attacker);

        // 攻击者拿回的应远小于 donate 进去的 1 ether + 自己 deposit 的 1 wei
        // 因为 virtual shares 把 donate 资产摊给所有 shareholder
        assertLt(stolen, 1 ether, "attacker stole the donation");

        // 受害者 redeem 自己的 share，应该几乎拿回 1 ether
        vm.prank(alice);
        uint256 aliceOut = vault.redeem(aliceShares, alice, alice);

        // 受害者损失应在 1% 以内
        assertGt(aliceOut, 0.99 ether, "victim lost too much");
    }

    /// @notice maxWithdraw / maxRedeem 一致性。
    function test_MaxFunctions() public {
        vm.startPrank(alice);
        asset.approve(address(vault), 50 ether);
        vault.deposit(50 ether, alice);
        vm.stopPrank();

        assertEq(vault.maxWithdraw(alice), 50 ether);
        uint256 maxR = vault.maxRedeem(alice);
        assertEq(maxR, vault.balanceOf(alice));
    }

    /// @notice convertToShares / convertToAssets round-trip。
    function test_ConvertRoundTrip() public {
        // 先放一笔 base liquidity 让 ratio 不为空
        vm.startPrank(bob);
        asset.approve(address(vault), 100 ether);
        vault.deposit(100 ether, bob);
        vm.stopPrank();

        uint256 shares = vault.convertToShares(7 ether);
        uint256 back = vault.convertToAssets(shares);
        // 因为整数除法，可能差 1 wei
        assertApproxEqAbs(back, 7 ether, 1);
    }

    /// @notice fuzz：任意 deposit + donate 后，受害者份额仍然非零。
    function testFuzz_VictimAlwaysGetsShares(uint96 donateAmt, uint96 victimDeposit) public {
        donateAmt = uint96(bound(donateAmt, 1, 1e30));
        victimDeposit = uint96(bound(victimDeposit, 1e6, 1e30));

        // attacker 1 wei seed
        vm.startPrank(attacker);
        asset.mint(attacker, 1);
        asset.approve(address(vault), 1);
        vault.deposit(1, attacker);
        vm.stopPrank();

        // attacker donate
        asset.mint(attacker, donateAmt);
        vm.prank(attacker);
        asset.transfer(address(vault), donateAmt);

        // victim deposit
        asset.mint(alice, victimDeposit);
        vm.startPrank(alice);
        asset.approve(address(vault), victimDeposit);
        uint256 sh = vault.deposit(victimDeposit, alice);
        vm.stopPrank();

        // 关键不变量：在 decimal offset=6 防御下，受害者 share 永远不为 0
        assertGt(sh, 0, "inflation attack succeeded against victim");
    }
}
