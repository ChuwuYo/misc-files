// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test, StdInvariant} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {StakingPool} from "./StakingPool.sol";

contract Tok is ERC20 {
    constructor() ERC20("T","T") { _mint(msg.sender, 1e30); }
}

contract Handler is Test {
    StakingPool public pool;
    Tok public stake; Tok public reward;
    address[] public actors = [address(0xA1), address(0xA2), address(0xA3)];

    constructor(StakingPool p, Tok s, Tok r) {
        pool = p; stake = s; reward = r;
        for (uint256 i; i < actors.length; ++i) {
            stake.transfer(actors[i], 1e24);
            vm.prank(actors[i]);
            stake.approve(address(pool), type(uint256).max);
        }
    }

    function stakeFor(uint256 seed, uint256 amt) external {
        amt = bound(amt, 1, 1e22);
        address a = actors[seed % actors.length];
        vm.prank(a);
        try pool.stake(amt) {} catch {}
    }

    function unstakeFor(uint256 seed, uint256 amt) external {
        address a = actors[seed % actors.length];
        amt = bound(amt, 0, pool.balanceOf(a));
        if (amt == 0) return;
        vm.prank(a);
        try pool.unstake(amt) {} catch {}
    }

    function warp(uint256 secs) external {
        secs = bound(secs, 1, 1 days);
        vm.warp(block.timestamp + secs);
    }
}

contract InvariantTest is StdInvariant, Test {
    StakingPool pool;
    Tok stake; Tok reward;
    Handler handler;

    function setUp() public {
        stake = new Tok(); reward = new Tok();
        pool = new StakingPool(stake, reward, 1e15);
        reward.transfer(address(pool), 1e26);
        handler = new Handler(pool, stake, reward);
        targetContract(address(handler));
    }

    /// 任务：你需要补全至少 4 条 invariant，跑通 100k 调用
    /// 提示模板：
    function invariant_totalStakedMatchesContractBalance() public view {
        // 不变量：合约持有的 stakeToken 数量 >= totalStaked
        assertGe(stake.balanceOf(address(pool)), pool.totalStaked());
    }

    function invariant_userBalanceSumMatchesTotal() public view {
        // TODO：自己写——遍历 actors，sum(balanceOf) 应等于 totalStaked
    }

    // 跑：
    // forge test --match-contract InvariantTest --invariant-runs 1000 --invariant-depth 100
    // 期望：你会发现 unstake 在 transfer 失败时仍然把 totalStaked 减掉了 → 状态不一致
}
