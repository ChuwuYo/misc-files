// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ERC-4626 inflation / first-depositor 攻击
/// @notice 还原模式：Cream（2021）、Hundred Finance、Sonne Finance（2024-05-15
/// 损失约 2000 万美元）等 cToken/Compound-V2 fork 的 inflation 攻击。
/// 共同特征：第一笔存款只存 1 wei，再向 vault "捐赠" 大额资产，让汇率跳到天文数字，
/// 此后所有小额存款被四舍五入吞掉。
contract NaiveVault {
    IERC20 public immutable asset;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    constructor(IERC20 _a) {
        asset = _a;
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @dev 漏洞：当 totalShares 极小（1）而 totalAssets 极大时，
    /// 后续 shares = assets * totalShares / totalAssets 被截断为 0，
    /// 用户存的钱被瞬间 socialised。
    function deposit(uint256 assets) external returns (uint256 minted) {
        uint256 ts = totalShares;
        uint256 ta = totalAssets();
        minted = ts == 0 ? assets : (assets * ts) / ta;
        require(minted > 0 || ts == 0, "share=0"); // 这条 require 也可能被绕过
        asset.transferFrom(msg.sender, address(this), assets);
        shares[msg.sender] += minted;
        totalShares += minted;
    }

    function redeem(uint256 sh) external returns (uint256 paid) {
        paid = (sh * totalAssets()) / totalShares;
        shares[msg.sender] -= sh;
        totalShares -= sh;
        asset.transfer(msg.sender, paid);
    }
}
