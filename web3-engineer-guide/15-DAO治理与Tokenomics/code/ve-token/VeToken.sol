// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title VeToken — Curve VotingEscrow 风格简化版
/// @notice 核心机制：
///         1. 用户锁仓 lockToken (CRV)，锁期 1 周 - 4 年
///         2. ve 余额 = amount × (剩余锁期 / MAX_LOCK)
///         3. 余额随时间线性衰减，到 endTime 归零
///         4. 用户可 increaseAmount / increaseUnlockTime（不可缩短）
///         5. 完整版还需 epoch checkpoint 用于 balanceOfAt(block) 历史快照
contract VeToken {
    IERC20 public immutable lockToken;
    uint256 public constant MAX_LOCK = 4 * 365 days;
    uint256 public constant MIN_LOCK = 1 weeks;
    uint256 public constant WEEK = 1 weeks;

    struct Lock {
        uint256 amount;
        uint256 endTime;
    }

    mapping(address => Lock) public locks;
    uint256 public totalLocked;

    event Locked(address indexed user, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _lockToken) {
        lockToken = IERC20(_lockToken);
    }

    /// @notice 创建新锁仓
    function createLock(uint256 amount, uint256 unlockTime) external {
        require(locks[msg.sender].amount == 0, "Already locked");
        require(amount > 0, "Zero amount");

        // 向下取整到 WEEK 边界（与 Curve 一致）
        uint256 unlock = (unlockTime / WEEK) * WEEK;
        require(unlock > block.timestamp + MIN_LOCK, "Lock too short");
        require(unlock <= block.timestamp + MAX_LOCK, "Lock too long (max 4y)");

        locks[msg.sender] = Lock({amount: amount, endTime: unlock});
        totalLocked += amount;
        require(lockToken.transferFrom(msg.sender, address(this), amount), "transfer failed");

        emit Locked(msg.sender, amount, unlock);
    }

    /// @notice 增加锁仓数量（不变 endTime）
    function increaseAmount(uint256 amount) external {
        Lock storage l = locks[msg.sender];
        require(l.amount > 0, "No lock");
        require(l.endTime > block.timestamp, "Lock expired");
        require(amount > 0, "Zero amount");

        l.amount += amount;
        totalLocked += amount;
        require(lockToken.transferFrom(msg.sender, address(this), amount), "transfer failed");

        emit Locked(msg.sender, l.amount, l.endTime);
    }

    /// @notice 延长锁仓到期时间（不可缩短）
    function increaseUnlockTime(uint256 newUnlockTime) external {
        Lock storage l = locks[msg.sender];
        require(l.amount > 0, "No lock");
        require(l.endTime > block.timestamp, "Lock expired");

        uint256 unlock = (newUnlockTime / WEEK) * WEEK;
        require(unlock > l.endTime, "Must increase");
        require(unlock <= block.timestamp + MAX_LOCK, "Lock too long (max 4y)");

        l.endTime = unlock;
        emit Locked(msg.sender, l.amount, unlock);
    }

    /// @notice 锁仓到期后取回
    function withdraw() external {
        Lock storage l = locks[msg.sender];
        require(l.amount > 0, "No lock");
        require(l.endTime <= block.timestamp, "Lock not expired");

        uint256 amount = l.amount;
        delete locks[msg.sender];
        totalLocked -= amount;
        require(lockToken.transfer(msg.sender, amount), "transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice 当前 ve 余额（线性衰减）
    function balanceOf(address user) public view returns (uint256) {
        Lock memory l = locks[user];
        if (block.timestamp >= l.endTime) return 0;
        uint256 remaining = l.endTime - block.timestamp;
        return (l.amount * remaining) / MAX_LOCK;
    }

    /// @notice 全局 ve 总供应量（粗略估计：所有 lock 按当前剩余加权）
    /// @dev 真实 Curve 用 epoch checkpoint 精确计算，这里简化
    function totalSupply() external view returns (uint256) {
        // 警告：此实现 O(N) 不可扩展
        // 真实 Curve 用 globalPointHistory + slope_changes 实现 O(log N)
        // 本简化版仅作教学
        return totalLocked / 2;  // 粗略：假设平均锁期 = MAX_LOCK / 2
    }
}
