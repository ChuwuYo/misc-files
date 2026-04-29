// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

/// @title Seaport-style 极简撮合
/// 教学背景：见 ../../../README.md 第 28 章
/// 关键差异 vs 真 Seaport：
///   - 单 offer / 单 consideration（真版本支持多对多）
///   - 没有 zone hooks、conduit、counter
contract MiniMarket is EIP712 {
    using ECDSA for bytes32;

    struct Order {
        address seller;
        address nft;
        uint256 tokenId;
        uint256 price;
        uint256 nonce;
        uint64 deadline;
    }

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address nft,uint256 tokenId,uint256 price,uint256 nonce,uint64 deadline)"
    );

    /// @dev seller => nonce => used。nonce 由 seller 自己管理，递增或随机皆可
    mapping(address => mapping(uint256 => bool)) public used;

    error Expired();
    error WrongPrice();
    error NonceUsed();
    error BadSig();

    constructor() EIP712("MiniMarket", "1") {}

    function fulfill(Order calldata o, bytes calldata sig) external payable {
        if (block.timestamp > o.deadline) revert Expired();
        if (msg.value != o.price) revert WrongPrice();
        if (used[o.seller][o.nonce]) revert NonceUsed();

        // why: EIP-712 hashTypedDataV4 防 phishing —— signature 域绑定了合约地址 + chainId
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            ORDER_TYPEHASH, o.seller, o.nft, o.tokenId, o.price, o.nonce, o.deadline
        )));
        if (digest.recover(sig) != o.seller) revert BadSig();

        used[o.seller][o.nonce] = true;

        // 1) 算 royalty（容忍 NFT 没实现 ERC-2981 的情况）
        uint256 royaltyAmt;
        address royaltyRecv;
        try IERC2981(o.nft).royaltyInfo(o.tokenId, o.price) returns (address r, uint256 a) {
            // why: cap 最高 10%，防止 royaltyInfo 返回离谱值套牢买家
            if (a <= o.price / 10) {
                royaltyRecv = r;
                royaltyAmt = a;
            }
        } catch {}

        // 2) 转 NFT
        IERC721(o.nft).transferFrom(o.seller, msg.sender, o.tokenId);

        // 3) 分账
        if (royaltyAmt > 0 && royaltyRecv != address(0)) {
            (bool ok1, ) = royaltyRecv.call{value: royaltyAmt}("");
            require(ok1, "royalty pay fail");
        }
        (bool ok2, ) = o.seller.call{value: o.price - royaltyAmt}("");
        require(ok2, "seller pay fail");
    }

    /// @notice seller 主动作废未来订单
    function cancel(uint256 nonce) external {
        used[msg.sender][nonce] = true;
    }
}
