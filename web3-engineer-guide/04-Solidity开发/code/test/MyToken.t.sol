// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MyToken} from "../src/MyToken.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/// @notice 单元 + 模糊测试套件
contract MyTokenTest is Test {
    MyToken internal token;
    address internal admin = address(0xA11CE);
    address internal alice = address(0xBEEF);
    address internal bob = address(0xCAFE);

    uint256 internal constant CAP = 1_000_000 ether;

    function setUp() public {
        vm.prank(admin);
        token = new MyToken("MyToken", "MTK", CAP, admin);
    }

    /* -------------------------- 基本铸造与转账 -------------------------- */

    function test_initialState() public view {
        assertEq(token.totalSupply(), 0);
        assertEq(token.MINT_CAP(), CAP);
        assertTrue(token.hasRole(token.MINTER_ROLE(), admin));
    }

    function test_mint_byMinter() public {
        vm.prank(admin);
        token.mint(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
    }

    function test_revert_mint_byNonMinter() public {
        vm.expectRevert();
        vm.prank(alice);
        token.mint(alice, 100 ether);
    }

    function test_revert_mint_overCap() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(MyToken.MintCapExceeded.selector, CAP + 1, CAP));
        token.mint(alice, CAP + 1);
    }

    /* ------------------------------ 模糊测试 ------------------------------ */

    /// @notice 铸造数量 <= CAP 时永不 revert，余额恒等于铸造数量
    function testFuzz_mint_underCap(uint256 amount) public {
        amount = bound(amount, 0, CAP);
        vm.prank(admin);
        token.mint(alice, amount);
        assertEq(token.balanceOf(alice), amount);
    }

    /// @notice 任意账户的余额转账后守恒
    function testFuzz_transfer_conserves(uint256 mintAmt, uint256 sendAmt) public {
        mintAmt = bound(mintAmt, 0, CAP);
        sendAmt = bound(sendAmt, 0, mintAmt);

        vm.prank(admin);
        token.mint(alice, mintAmt);

        vm.prank(alice);
        token.transfer(bob, sendAmt);

        assertEq(token.balanceOf(alice) + token.balanceOf(bob), mintAmt);
    }

    /* ----------------------------- EIP-2612 ---------------------------- */

    function test_permit() public {
        uint256 ownerKey = 0xA11CE;
        address owner = vm.addr(ownerKey);
        uint256 value = 50 ether;
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(admin);
        token.mint(owner, 100 ether);

        bytes32 PERMIT_TYPEHASH =
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, bob, value, token.nonces(owner), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        token.permit(owner, bob, value, deadline, v, r, s);

        assertEq(token.allowance(owner, bob), value);
        assertEq(token.nonces(owner), 1);
    }
}
