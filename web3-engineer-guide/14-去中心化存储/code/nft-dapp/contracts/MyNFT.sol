// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MyNFT - ERC-721 with immutable IPFS baseURI
/// @notice Module 14 demo NFT，演示 baseURI 永久不可变 + IPFS 元数据
contract MyNFT is ERC721, Ownable {
    /// IPFS base URI，形如 `ipfs://bafy.../`
    /// 永远不再改 —— 这是真去中心化的关键
    string private _baseTokenURI;

    /// 构造时计算的 hash，外部可读取并校验链下数据完整性
    bytes32 public immutable BASE_URI_HASH;

    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 10000;

    event Minted(address indexed to, uint256 indexed tokenId);

    constructor(string memory baseURI_, address owner_)
        ERC721("Web3 Engineer NFT", "W3ENG")
        Ownable(owner_)
    {
        require(bytes(baseURI_).length > 0, "Empty baseURI");
        _baseTokenURI = baseURI_;
        BASE_URI_HASH = keccak256(bytes(baseURI_));
    }

    function mint(address to) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        require(tokenId < MAX_SUPPLY, "Max supply reached");
        _safeMint(to, tokenId);
        emit Minted(to, tokenId);
        return tokenId;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /// @notice 完整 tokenURI 形如 `ipfs://bafy.../1.json`
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return string(abi.encodePacked(_baseURI(), _toString(tokenId), ".json"));
    }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 temp = v;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (v != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + v % 10));
            v /= 10;
        }
        return string(buffer);
    }
}
