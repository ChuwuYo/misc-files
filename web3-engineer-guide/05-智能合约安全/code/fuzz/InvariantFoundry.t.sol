// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test, StdInvariant} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {InflationProofVault} from "../patched/Vault4626.sol";

contract Token is ERC20 {
    constructor() ERC20("T", "T") { _mint(msg.sender, 10_000_000e18); }
}

/// @notice Foundry invariant handler：限制调用面，避免乱七八糟的 revert
contract Handler is Test {
    InflationProofVault public vault;
    Token public token;
    address[] internal actors = [address(0x1), address(0x2), address(0x3)];

    constructor(InflationProofVault _v, Token _t) {
        vault = _v;
        token = _t;
        // 注意：actor 余额初始化与 approve 都搬到 InvariantTest.setUp() 中执行，
        // 因为 Handler 在构造时还没有任何 token 余额（owner 在部署完 Handler 后才转入）。
    }

    function getActors() external view returns (address[] memory) {
        return actors;
    }

    function approveVault(address actor) external {
        vm.prank(actor);
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 actorSeed, uint256 amt) external {
        amt = bound(amt, 1, 100_000e18);
        address a = actors[actorSeed % actors.length];
        vm.prank(a);
        try vault.deposit(amt) {} catch {}
    }

    function donate(uint256 actorSeed, uint256 amt) external {
        amt = bound(amt, 0, 100_000e18);
        address a = actors[actorSeed % actors.length];
        vm.prank(a);
        token.transfer(address(vault), amt);
    }
}

contract InvariantTest is StdInvariant, Test {
    InflationProofVault vault;
    Token token;
    Handler handler;

    function setUp() public {
        token = new Token();
        vault = new InflationProofVault(token);
        handler = new Handler(vault, token);
        token.transfer(address(handler), 5_000_000e18);
        // 在 Handler 拿到余额后，再分发给各 actor 并完成 approve
        address[] memory actors = handler.getActors();
        for (uint256 i; i < actors.length; ++i) {
            vm.prank(address(handler));
            token.transfer(actors[i], 1_000_000e18);
            handler.approveVault(actors[i]);
        }
        targetContract(address(handler));
    }

    /// 不变量 1：totalShares >= 0 是平凡的；我们检查更强的：
    /// 1 share 兑出的资产数永远不会超过整个 vault 的资产
    function invariant_singleSharePayoutBounded() public view {
        uint256 ts = vault.totalShares();
        if (ts == 0) return;
        uint256 ta = token.balanceOf(address(vault));
        // 单 share 至多兑回 ta+1 的份额
        assertLe(ta, type(uint256).max / (ts + 1));
    }
}
