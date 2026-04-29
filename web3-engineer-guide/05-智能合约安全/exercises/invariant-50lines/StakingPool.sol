// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title 50 行内的 staking pool —— 你的任务
/// @notice 你需要：
/// 1. 阅读这 50 行，找出至少 4 条 invariant
/// 2. 用 Foundry invariant 测试跑 100k 次调用
/// 3. 至少要找到 1 个真实漏洞（提示：精度 / 重入 / 时间戳）
/// 完成后参考 ./InvariantTest.t.sol 模板
contract StakingPool {
    IERC20 public immutable stakeToken;
    IERC20 public immutable rewardToken;

    uint256 public totalStaked;
    uint256 public rewardPerToken;       // 累计 reward / staked
    uint256 public lastUpdateTime;
    uint256 public rewardRate;           // reward / second

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    constructor(IERC20 s, IERC20 r, uint256 _rate) {
        stakeToken = s; rewardToken = r; rewardRate = _rate;
        lastUpdateTime = block.timestamp;
    }

    function _update(address u) internal {
        if (totalStaked > 0) {
            rewardPerToken += (block.timestamp - lastUpdateTime) * rewardRate * 1e18 / totalStaked;
        }
        lastUpdateTime = block.timestamp;
        if (u != address(0)) {
            rewards[u] += balanceOf[u] * (rewardPerToken - userRewardPerTokenPaid[u]) / 1e18;
            userRewardPerTokenPaid[u] = rewardPerToken;
        }
    }

    function stake(uint256 amt) external {
        _update(msg.sender);
        stakeToken.transferFrom(msg.sender, address(this), amt);
        balanceOf[msg.sender] += amt;
        totalStaked += amt;
    }

    function unstake(uint256 amt) external {
        _update(msg.sender);
        balanceOf[msg.sender] -= amt;
        totalStaked -= amt;
        stakeToken.transfer(msg.sender, amt);  // ← 这里有问题
    }

    function claim() external {
        _update(msg.sender);
        uint256 r = rewards[msg.sender];
        rewards[msg.sender] = 0;
        rewardToken.transfer(msg.sender, r);
    }
}
