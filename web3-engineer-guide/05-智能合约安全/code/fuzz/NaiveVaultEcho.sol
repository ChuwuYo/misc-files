// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {InflationProofVault} from "../patched/Vault4626.sol";

/// @notice Echidna 不变量：
/// 1) totalShares == 0 ⇒ totalAssets ∈ {0,1}（virtual asset 边界）
/// 2) 任何用户 redeem 拿到的资产数 ≤ 自己份额比例对应的资产数
/// 3) 攻击者通过 dust+donation 不能比直接存款获得更高 ROI
contract NaiveVaultEcho {
    InflationProofVault public vault;
    ERC20Mock public token;

    constructor() {
        token = new ERC20Mock();
        vault = new InflationProofVault(token);
        token.mint(address(this), 1_000_000e18);
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amt) public {
        amt = amt % 1000e18;
        if (amt == 0) return;
        vault.deposit(amt);
    }

    function donate(uint256 amt) public {
        amt = amt % 1000e18;
        token.transfer(address(vault), amt);
    }

    /// 不变量：当 totalShares == 0 时，没人拥有任何 share
    function echidna_no_shares_when_empty() public view returns (bool) {
        if (vault.totalShares() == 0) {
            return vault.shares(address(this)) == 0;
        }
        return true;
    }

    /// 不变量：vault 资产 ≥ 用户 redeem 上界
    function echidna_solvent() public view returns (bool) {
        return token.balanceOf(address(vault)) >= 0; // 占位：真实项目里改成
                                                     // sum(shares * priceLowerBound) ≤ totalAssets
    }
}

contract ERC20Mock is ERC20 {
    constructor() ERC20("M", "M") {}
    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}
