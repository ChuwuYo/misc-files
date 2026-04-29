// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AirdropMerkle
 * @notice 同时演示 Solidity 中的 Merkle 证明白名单 + ecrecover 验签
 * @dev    与 03_merkle_tree.py 的构造完全兼容（commutative keccak，叶子 = keccak(addr ‖ amount)）
 *         OpenZeppelin Contracts v5.x
 */
contract AirdropMerkle is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    bytes32 public immutable merkleRoot;
    address public immutable signer; // 用于 ECDSA 校验的签名者

    mapping(address => bool) public claimed;

    error AlreadyClaimed();
    error InvalidProof();
    error InvalidSignature();

    event Claimed(address indexed user, uint256 amount);

    constructor(IERC20 _token, bytes32 _root, address _signer) Ownable(msg.sender) {
        token = _token;
        merkleRoot = _root;
        signer = _signer;
    }

    /// @notice 用户领空投：要求名单证明 + 服务端额外签名（双重门）
    function claim(uint256 amount, bytes32[] calldata proof, bytes calldata sig) external {
        if (claimed[msg.sender]) revert AlreadyClaimed();

        // 1) Merkle 证明：叶子 = keccak256(abi.encodePacked(user, amount))
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verifyCalldata(proof, merkleRoot, leaf)) revert InvalidProof();

        // 2) ECDSA：可选的二级闸门，比如 KYC pass、防 sybil
        bytes32 digest = keccak256(abi.encodePacked(msg.sender, amount, address(this), block.chainid));
        bytes32 ethSigned = MessageHashUtils_toEthSignedMessageHash(digest);
        if (ECDSA.recover(ethSigned, sig) != signer) revert InvalidSignature();

        claimed[msg.sender] = true;
        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice 内联 EIP-191 personal_sign 前缀；正式项目请直接 import MessageHashUtils
    function MessageHashUtils_toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    /// @notice 演示用：低级 ecrecover（生产请用 OZ ECDSA 库，自带 EIP-2 low-s 与 EIP-2098 处理）
    function recoverLowLevel(bytes32 h, uint8 v, bytes32 r, bytes32 s) external pure returns (address) {
        // EIP-2: 防签名延展性，必须拒绝高位 s
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "high-s");
        require(v == 27 || v == 28, "bad v");
        return ecrecover(h, v, r, s);
    }
}
