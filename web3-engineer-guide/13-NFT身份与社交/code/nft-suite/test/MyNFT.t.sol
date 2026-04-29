// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MyNFT} from "../src/MyNFT.sol";

/// @notice 完整覆盖 mint / soulbound / rental / royalty 路径
contract MyNFTTest is Test {
    MyNFT nft;
    address admin = makeAddr("admin");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        nft = new MyNFT(admin);
    }

    function test_normalMintAndTransfer() public {
        vm.prank(admin);
        uint256 id = nft.mint(alice, "ipfs://x", false);

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        assertEq(nft.ownerOf(id), bob);
    }

    function test_soulboundCannotTransfer() public {
        vm.prank(admin);
        uint256 id = nft.mint(alice, "ipfs://sbt", true);

        assertTrue(nft.locked(id));

        vm.prank(alice);
        vm.expectRevert(bytes("Soulbound: cannot transfer"));
        nft.transferFrom(alice, bob, id);
    }

    function test_soulboundOwnership() public {
        // why: SBT mint 后 owner 应正确登记；MyNFT 未暴露 burn，
        // 这里仅验证 mint(from=0) 放行 + 所有权登记这条路径
        vm.prank(admin);
        uint256 id = nft.mint(alice, "ipfs://sbt", true);

        assertEq(nft.ownerOf(id), alice);
    }

    function test_rentalSetUserAndExpire() public {
        vm.prank(admin);
        uint256 id = nft.mint(alice, "ipfs://x", false);

        vm.prank(alice);
        nft.setUser(id, bob, uint64(block.timestamp + 1 days));

        assertEq(nft.userOf(id), bob);
        // why: lazy expire 验证
        vm.warp(block.timestamp + 2 days);
        assertEq(nft.userOf(id), address(0));
    }

    function test_rentalClearedOnTransfer() public {
        vm.prank(admin);
        uint256 id = nft.mint(alice, "ipfs://x", false);

        vm.prank(alice);
        nft.setUser(id, bob, uint64(block.timestamp + 7 days));

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        // why: 转让所有权时租户应被清空（防止历史租户语义跟到新主）
        assertEq(nft.userOf(id), address(0));
    }

    function test_royalty() public {
        vm.prank(admin);
        uint256 id = nft.mint(alice, "ipfs://x", false);

        (address recv, uint256 amt) = nft.royaltyInfo(id, 1 ether);
        assertEq(recv, admin);
        assertEq(amt, 0.05 ether);
    }

    function test_supportsInterface() public {
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(nft.supportsInterface(0x5b5e139f)); // ERC-721 Metadata
        assertTrue(nft.supportsInterface(0x2a55205a)); // ERC-2981
        assertTrue(nft.supportsInterface(0xad092b5c)); // ERC-4907
        assertTrue(nft.supportsInterface(0xb45a3c0e)); // ERC-5192
    }

    function test_unauthorizedMintReverts() public {
        vm.prank(alice);
        vm.expectRevert(); // AccessControlUnauthorizedAccount
        nft.mint(alice, "ipfs://x", false);
    }
}
