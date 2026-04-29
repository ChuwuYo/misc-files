// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title 修复版：CEI + ReentrancyGuard，写状态在转账之前。
contract SafeBank is ReentrancyGuard {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external nonReentrant {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "no balance");
        balances[msg.sender] = 0; // CEI：先改账
        (bool ok, ) = msg.sender.call{value: bal}("");
        require(ok, "send fail");
    }

    receive() external payable {}
}

/// @title 修复版：删流动性同时锁住读路径
contract SafeLP is ReentrancyGuard {
    uint256 public totalShares;
    uint256 public totalAssets;
    mapping(address => uint256) public shares;

    error Reentered();

    function deposit() external payable nonReentrant {
        uint256 minted = totalShares == 0
            ? msg.value
            : (msg.value * totalShares) / totalAssets;
        shares[msg.sender] += minted;
        totalShares += minted;
        totalAssets += msg.value;
    }

    function removeLiquidity(uint256 amount) external nonReentrant {
        require(shares[msg.sender] >= amount, "no shares");
        uint256 payout = (amount * totalAssets) / totalShares;
        // CEI 顺序：先扣再转
        shares[msg.sender] -= amount;
        totalShares -= amount;
        totalAssets -= payout;
        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "send fail");
    }

    /// @dev 关键：view 读路径也走 nonReentrant 检查（OZ 5.x 提供 _reentrancyGuardEntered）
    function pricePerShare() external view returns (uint256) {
        if (_reentrancyGuardEntered()) revert Reentered();
        if (totalShares == 0) return 1e18;
        return (totalAssets * 1e18) / totalShares;
    }
}
