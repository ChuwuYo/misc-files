// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC4907} from "./ERC4907.sol";

interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

/// @title 综合 NFT：ERC-721 + ERC-2981 + ERC-4907 + ERC-5192（per-token soulbound）
/// 详细教学背景见 ../../README.md 第 25 章
contract MyNFT is ERC721URIStorage, ERC4907, ERC2981, AccessControl, IERC5192 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextId;
    mapping(uint256 => bool) private _locked;
    // why: per-token soulbound flag。允许同一合约里既有可转让 NFT 也有 SBT
    // why: Locked/Unlocked 事件继承自 IERC5192，不在此重复声明

    constructor(address admin) ERC721("MyNFT", "MNFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _setDefaultRoyalty(admin, 500);
        // why: 默认 5% royalty 给 admin。生产中应该是 splitter 合约
    }

    function mint(address to, string calldata uri, bool isSoulbound)
        external onlyRole(MINTER_ROLE) returns (uint256 id)
    {
        id = _nextId++;
        _safeMint(to, id);
        _setTokenURI(id, uri);
        if (isSoulbound) {
            _locked[id] = true;
            emit Locked(id);
            // why: ERC-5192 要求 SBT mint 时 emit Locked，让 indexer 立刻知道
        }
    }

    function locked(uint256 tokenId) external view override returns (bool) {
        return _locked[tokenId];
    }

    /// @dev 多重继承下统一 _update：先验 SBT 锁定，再走父类
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC4907) returns (address)
    {
        address from = _ownerOf(tokenId);
        // why: from=0 是 mint，to=0 是 burn；两者放行；只阻断真实转让
        if (_locked[tokenId] && from != address(0) && to != address(0)) {
            revert("Soulbound: cannot transfer");
        }
        return super._update(to, tokenId, auth);
    }

    /// @dev 必须手写 supportsInterface 处理菱形继承
    function supportsInterface(bytes4 id)
        public view override(ERC721URIStorage, ERC2981, AccessControl) returns (bool)
    {
        // why: 显式声明实现的 EIP（OZ 已默认含 ERC-721 / ERC-721 Metadata）
        return id == 0xb45a3c0e // ERC-5192
            || id == 0xad092b5c // ERC-4907
            || super.supportsInterface(id);
    }
}
