// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {VulnerableClaim} from "../vulnerable/Signature.sol";
import {SafeClaim} from "../patched/Signature.sol";

contract MockToken is ERC20 {
    constructor() ERC20("M", "M") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract SignatureTest is Test {
    MockToken token;

    function setUp() public {
        token = new MockToken();
    }

    /// @dev 演示 ecrecover 0 地址陷阱：当 signer 错误地是 address(0)，
    /// 任何垃圾签名都能 mint。
    function test_ZeroSignerIsExploitable() public {
        VulnerableClaim claimer = new VulnerableClaim(token, address(0));
        token.transfer(address(claimer), 1000e18);

        // 提供任意 v=0 r=0 s=0，让 ecrecover 返回 address(0)
        vm.prank(address(0xCAFE));
        claimer.claim(500e18, 0, bytes32(0), bytes32(0));
        assertEq(token.balanceOf(address(0xCAFE)), 500e18);
    }

    function test_SafeClaim_rejectsReplay() public {
        (address signer, uint256 sk) = makeAddrAndKey("signer");
        SafeClaim claimer = new SafeClaim(token, signer);
        token.transfer(address(claimer), 1000e18);

        address user = address(0xBEEF);
        uint256 amount = 100e18;
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 typeHash = keccak256("Claim(address user,uint256 amount,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(typeHash, user, amount, 0, deadline));
        bytes32 domainSep = claimer.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(user);
        claimer.claim(amount, deadline, sig);
        assertEq(token.balanceOf(user), amount);

        // 重放应被 nonce 拦下
        vm.prank(user);
        vm.expectRevert();
        claimer.claim(amount, deadline, sig);
    }
}
