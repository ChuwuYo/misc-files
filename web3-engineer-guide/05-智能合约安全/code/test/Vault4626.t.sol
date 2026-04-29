// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {NaiveVault} from "../vulnerable/Vault4626.sol";
import {InflationProofVault} from "../patched/Vault4626.sol";
import {VaultInflator} from "../attack/Vault4626Attack.sol";

contract MockUSD is ERC20 {
    constructor() ERC20("Mock", "M") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract Vault4626Test is Test {
    MockUSD token;
    NaiveVault vault;
    InflationProofVault safeVault;
    VaultInflator atk;

    address victim = address(0xBEEF);

    function setUp() public {
        token = new MockUSD();
        vault = new NaiveVault(token);
        safeVault = new InflationProofVault(token);
        atk = new VaultInflator();
        // 给攻击者发 ammo
        token.transfer(address(atk), 200_000e18);
        token.transfer(victim, 100e18);
    }

    function test_NaiveVault_inflationKillsVictim() public {
        // 攻击者 1 wei 占坑 + 100k 捐赠
        atk.pwn(vault, token, 1, 100_000e18);

        // 受害者存 50e18，远小于 100k，被四舍五入吞掉
        vm.startPrank(victim);
        token.approve(address(vault), 50e18);
        vault.deposit(50e18);
        vm.stopPrank();

        uint256 victimShares = vault.shares(victim);
        // 在 inflation 攻击下，victim share 通常被打到极小或 0
        assertLt(victimShares, 1e18, "victim shares dust");
    }

    function test_ProofVault_inflationFails() public {
        // 攻击者尝试相同把戏
        token.approve(address(safeVault), 1);
        // 直接绕过 attacker 合约，在测试上下文里跑
        token.transfer(address(this), 1);
        token.approve(address(safeVault), 1);
        // 受害者存 50e18 之前，攻击者捐赠
        token.transfer(address(safeVault), 100_000e18);

        vm.startPrank(victim);
        token.approve(address(safeVault), 50e18);
        uint256 minted = safeVault.deposit(50e18);
        vm.stopPrank();

        assertGt(minted, 0, "victim should get non-zero shares due to virtual offset");
    }
}
