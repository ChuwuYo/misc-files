// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title 修复版：EIP-712 域分隔 + nonce + 0 地址检查 + s 低半区
contract SafeClaim is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(address user,uint256 amount,uint256 nonce,uint256 deadline)");

    IERC20 public immutable token;
    address public immutable signer;
    mapping(address => uint256) public nonces;

    error BadSigner();
    error Expired();

    constructor(IERC20 _t, address _signer) EIP712("SafeClaim", "1") {
        require(_signer != address(0), "zero signer");
        token = _t;
        signer = _signer;
    }

    function claim(
        uint256 amount,
        uint256 deadline,
        bytes calldata sig
    ) external {
        if (block.timestamp > deadline) revert Expired();
        uint256 nonce = nonces[msg.sender]++;
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, msg.sender, amount, nonce, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        // OZ 的 ECDSA.recover 会拒绝 s 高半区与 v ∉ {27,28} 的非规范签名，
        // 并在 ecrecover 返回 0 时 revert。
        address recovered = digest.recover(sig);
        if (recovered != signer) revert BadSigner();
        token.transfer(msg.sender, amount);
    }
}
