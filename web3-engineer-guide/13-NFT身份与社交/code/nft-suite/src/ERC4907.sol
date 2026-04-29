// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title ERC-4907 reference 实现
/// @notice 在 ERC-721 之上加 user 角色（租户）+ 到期时间
/// 来源: https://eips.ethereum.org/EIPS/eip-4907 （检索 2026-04）
abstract contract ERC4907 is ERC721 {
    struct UserInfo {
        address user;
        uint64 expires;
    }

    mapping(uint256 => UserInfo) internal _users;

    event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);

    /// @notice 设租户。owner 或被 approved 才能调
    function setUser(uint256 tokenId, address user, uint64 expires) public virtual {
        // why: 复用 OZ v5 的 _isAuthorized 检查；它处理了 owner / approved / operator 三种合法路径
        require(_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId), "ERC4907: not authorized");
        UserInfo storage info = _users[tokenId];
        info.user = user;
        info.expires = expires;
        emit UpdateUser(tokenId, user, expires);
    }

    /// @notice 当前租户。过期自动返回 0
    function userOf(uint256 tokenId) public view virtual returns (address) {
        if (uint256(_users[tokenId].expires) >= block.timestamp) {
            return _users[tokenId].user;
        }
        // why: lazy expire，省掉一次 storage write
        return address(0);
    }

    function userExpires(uint256 tokenId) public view virtual returns (uint256) {
        return _users[tokenId].expires;
    }

    /// @dev v5 用 _update 当统一 hook
    function _update(address to, uint256 tokenId, address auth)
        internal virtual override returns (address)
    {
        address from = super._update(to, tokenId, auth);
        // why: 转让所有权时清空租户。否则 NFT 易主后租户语义诡异
        if (from != to && _users[tokenId].user != address(0)) {
            delete _users[tokenId];
            emit UpdateUser(tokenId, address(0), 0);
        }
        return from;
    }
}
