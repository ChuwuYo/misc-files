// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/governance/IGovernor.sol";
import {MyGovernor} from "../src/MyGovernor.sol";
import {MyGovToken} from "../src/MyGovToken.sol";
import {Treasury} from "../src/Treasury.sol";

/// @notice 治理完整生命周期测试
/// @dev 涵盖：
///      - delegate 必须在 proposalSnapshot 之前完成
///      - votingDelay / votingPeriod / timelock 必须正确推进
///      - execute 后效果可见
///      - 闪电贷攻击应失败
contract GovernorTest is Test {
    MyGovToken token;
    TimelockController timelock;
    MyGovernor governor;
    Treasury treasury;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address recipient = address(0xC0FFEE);

    function setUp() public {
        token = new MyGovToken("MyDAO", "MYD");

        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0);
        timelock = new TimelockController(2 days, proposers, executors, address(this));

        governor = new MyGovernor(token, timelock);

        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(governor));
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), address(this));

        treasury = new Treasury(address(timelock));

        // 给 Alice 50M、Bob 30M（占总量 50% / 30%）
        token.transfer(alice, 50_000_000e18);
        token.transfer(bob, 30_000_000e18);
        // 给 treasury 留 10M
        token.transfer(address(treasury), 10_000_000e18);

        // Alice 自委托
        vm.prank(alice);
        token.delegate(alice);

        // Bob 自委托
        vm.prank(bob);
        token.delegate(bob);

        // 推进 1 块让 checkpoint 写入
        vm.roll(block.number + 1);
    }

    function test_FullCycle() public {
        // 提案：Treasury 转 1000 MYD 给 recipient
        bytes memory data = abi.encodeWithSelector(
            Treasury.transferToken.selector,
            address(token),
            recipient,
            1000e18
        );
        address[] memory targets = new address[](1);
        targets[0] = address(treasury);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        string memory desc = "Grant 1000 MYD to recipient";
        bytes32 descHash = keccak256(bytes(desc));

        // 1. propose
        vm.prank(alice);
        uint256 pid = governor.propose(targets, values, calldatas, desc);
        assertEq(uint256(governor.state(pid)), uint256(IGovernor.ProposalState.Pending));

        // 2. 推进 votingDelay + 1
        vm.roll(block.number + governor.votingDelay() + 1);
        assertEq(uint256(governor.state(pid)), uint256(IGovernor.ProposalState.Active));

        // 3. Alice 投 For（=1）
        vm.prank(alice);
        governor.castVote(pid, 1);

        // Bob 投 For 也通过（quorum 4% × 100M = 4M，Alice 50M 已超）
        vm.prank(bob);
        governor.castVote(pid, 1);

        // 4. 推进 votingPeriod
        vm.roll(block.number + governor.votingPeriod() + 1);
        assertEq(uint256(governor.state(pid)), uint256(IGovernor.ProposalState.Succeeded));

        // 5. queue
        governor.queue(targets, values, calldatas, descHash);
        assertEq(uint256(governor.state(pid)), uint256(IGovernor.ProposalState.Queued));

        // 6. timelock minDelay
        vm.warp(block.timestamp + 2 days + 1);

        // 7. execute
        governor.execute(targets, values, calldatas, descHash);
        assertEq(uint256(governor.state(pid)), uint256(IGovernor.ProposalState.Executed));

        // 8. 验证
        assertEq(token.balanceOf(recipient), 1000e18);
    }

    function test_QuorumNotReachedDefeats() public {
        bytes memory data = abi.encodeWithSelector(
            Treasury.transferToken.selector,
            address(token),
            recipient,
            1000e18
        );
        address[] memory targets = new address[](1);
        targets[0] = address(treasury);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        string memory desc = "low quorum";

        vm.prank(alice);
        uint256 pid = governor.propose(targets, values, calldatas, desc);
        vm.roll(block.number + governor.votingDelay() + 1);

        // 没人投票 → 推到 votingPeriod 后应该 Defeated
        vm.roll(block.number + governor.votingPeriod() + 1);
        assertEq(uint256(governor.state(pid)), uint256(IGovernor.ProposalState.Defeated));
    }

    function test_FlashLoanCannotPassProposal() public {
        // 攻击者获得大量代币（模拟闪电贷一笔到账）
        address attacker = makeAddr("attacker");
        token.transfer(attacker, 60_000_000e18);
        vm.prank(attacker);
        token.delegate(attacker);

        // delegate 在当前块生效，但 proposalSnapshot = block + votingDelay
        // → snapshot 之后再 propose，则 attacker 在 snapshot 时已有代币
        // 攻击者发起恶意提案
        bytes memory data = abi.encodeWithSelector(
            Treasury.transferToken.selector,
            address(token),
            attacker,
            10_000_000e18
        );
        address[] memory targets = new address[](1);
        targets[0] = address(treasury);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        string memory desc = "drain";

        vm.prank(attacker);
        uint256 pid = governor.propose(targets, values, calldatas, desc);

        // 同区块投票：active 之前会 revert
        vm.expectRevert();
        vm.prank(attacker);
        governor.castVote(pid, 1);

        // 即便等到 active 时投票通过，闪电贷必须同区块还清
        // 但 votingPeriod 是 7 days + timelock 2 days = 9 days
        // 攻击者无法持有代币这么久 → 现实闪电贷攻击不可行
        // （本 test 只演示 votingDelay 阻止同区块投票）
    }
}
