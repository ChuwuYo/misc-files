// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MiniMarket} from "../src/MiniMarket.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

contract Royal is ERC721, ERC2981 {
    constructor(address creator) ERC721("R", "R") {
        _setDefaultRoyalty(creator, 500); // 5%
    }
    function mint(address to, uint256 id) external { _safeMint(to, id); }
    function supportsInterface(bytes4 i) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(i);
    }
}

contract MiniMarketTest is Test {
    MiniMarket market;
    Royal nft;

    uint256 sellerPk = 0xAAA;
    address seller = vm.addr(0xAAA);
    address creator = makeAddr("creator");
    address buyer = makeAddr("buyer");

    function setUp() public {
        market = new MiniMarket();
        nft = new Royal(creator);
        nft.mint(seller, 1);

        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);
        // why: 教学例子用 setApprovalForAll；生产应改 single approve

        vm.deal(buyer, 10 ether);
    }

    function _signOrder(MiniMarket.Order memory o) internal view returns (bytes memory) {
        bytes32 typeHash = market.ORDER_TYPEHASH();
        bytes32 structHash = keccak256(abi.encode(
            typeHash, o.seller, o.nft, o.tokenId, o.price, o.nonce, o.deadline
        ));
        bytes32 domainSep = market.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sellerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_fulfillSplitsRoyaltyAndProceeds() public {
        MiniMarket.Order memory o = MiniMarket.Order({
            seller: seller, nft: address(nft), tokenId: 1,
            price: 1 ether, nonce: 1, deadline: uint64(block.timestamp + 1 hours)
        });
        bytes memory sig = _signOrder(o);

        uint256 sellerBefore = seller.balance;
        uint256 creatorBefore = creator.balance;

        vm.prank(buyer);
        market.fulfill{value: 1 ether}(o, sig);

        // why: 5% royalty 进 creator，剩下 95% 进 seller
        assertEq(creator.balance - creatorBefore, 0.05 ether);
        assertEq(seller.balance - sellerBefore, 0.95 ether);
        assertEq(nft.ownerOf(1), buyer);
    }

    function test_replayBlocked() public {
        MiniMarket.Order memory o = MiniMarket.Order({
            seller: seller, nft: address(nft), tokenId: 1,
            price: 1 ether, nonce: 7, deadline: uint64(block.timestamp + 1 hours)
        });
        bytes memory sig = _signOrder(o);

        vm.prank(buyer);
        market.fulfill{value: 1 ether}(o, sig);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        // why: nonce 用过即作废
        vm.expectRevert(MiniMarket.NonceUsed.selector);
        market.fulfill{value: 1 ether}(o, sig);
    }

    function test_expiredReverts() public {
        MiniMarket.Order memory o = MiniMarket.Order({
            seller: seller, nft: address(nft), tokenId: 1,
            price: 1 ether, nonce: 1, deadline: uint64(block.timestamp + 10)
        });
        bytes memory sig = _signOrder(o);

        vm.warp(block.timestamp + 100);
        vm.prank(buyer);
        vm.expectRevert(MiniMarket.Expired.selector);
        market.fulfill{value: 1 ether}(o, sig);
    }

    function test_wrongPriceReverts() public {
        MiniMarket.Order memory o = MiniMarket.Order({
            seller: seller, nft: address(nft), tokenId: 1,
            price: 1 ether, nonce: 1, deadline: uint64(block.timestamp + 1 hours)
        });
        bytes memory sig = _signOrder(o);

        vm.prank(buyer);
        vm.expectRevert(MiniMarket.WrongPrice.selector);
        market.fulfill{value: 0.5 ether}(o, sig);
    }

    function test_cancel() public {
        vm.prank(seller);
        market.cancel(42);
        assertTrue(market.used(seller, 42));
    }
}
