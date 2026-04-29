// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @title 经典经典重入：先转账后改状态
/// @notice 还原 The DAO（2016 年 6 月 17 日）的核心错误：状态更新晚于外部调用。
/// @dev 历史损失约 360 万 ETH（当时约 6000 万美元），最终促成以太坊硬分叉。
contract VulnerableBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    /// @dev 漏洞点：先 call 再清账，攻击者可以在 fallback 里再次进入 withdraw。
    function withdraw() external {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "no balance");
        (bool ok, ) = msg.sender.call{value: bal}("");
        require(ok, "send fail");
        balances[msg.sender] = 0;
    }

    receive() external payable {}
}

/// @title 只读重入：依赖外部 view 价格的二级合约会被骗
/// @notice 还原 Curve / Balancer 的 read-only reentrancy 模式：
/// 受害者读取池子在重入半途的脏视图，得到错误价格。
contract VulnerableLP {
    uint256 public totalShares;
    uint256 public totalAssets;
    mapping(address => uint256) public shares;

    function deposit() external payable {
        uint256 minted = totalShares == 0
            ? msg.value
            : (msg.value * totalShares) / totalAssets;
        shares[msg.sender] += minted;
        totalShares += minted;
        totalAssets += msg.value;
    }

    /// @dev 漏洞：先转 ETH 再更新 totalAssets/totalShares。
    function removeLiquidity(uint256 amount) external {
        require(shares[msg.sender] >= amount, "no shares");
        uint256 payout = (amount * totalAssets) / totalShares;
        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "send fail");
        shares[msg.sender] -= amount;
        totalShares -= amount;
        totalAssets -= payout;
    }

    /// @dev 价格在重入 reentry 期间被读到错误的中间状态。
    function pricePerShare() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalAssets * 1e18) / totalShares;
    }
}
