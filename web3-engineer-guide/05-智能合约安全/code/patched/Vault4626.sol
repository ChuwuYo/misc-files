// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title 修复版：OpenZeppelin 5.x 的 virtual shares + decimals offset 方案
/// @notice 思路：存在 1e^offset 个虚拟 share 与 1 个虚拟 asset，
/// 让攻击者必须捐 10^offset 倍才能把单 share 价格抬高一档；同时 deposit
/// 用 rounding-down，redeem 用 rounding-down，确保任何攻击都不可获利。
/// 同时使用 SafeERC20 包装 transfer/transferFrom，兼容 USDT 等非标 ERC20。
contract InflationProofVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    uint8 public constant DECIMALS_OFFSET = 6; // OZ 默认 0，多数协议建议 6 或 9
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    constructor(IERC20 _a) {
        asset = _a;
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function _convertToShares(uint256 assets) internal view returns (uint256) {
        // shares = assets * (totalShares + 10^offset) / (totalAssets + 1)
        return (assets * (totalShares + 10 ** DECIMALS_OFFSET)) / (totalAssets() + 1);
    }

    function _convertToAssets(uint256 sh) internal view returns (uint256) {
        return (sh * (totalAssets() + 1)) / (totalShares + 10 ** DECIMALS_OFFSET);
    }

    function deposit(uint256 assets) external returns (uint256 minted) {
        minted = _convertToShares(assets);
        require(minted > 0, "share=0");
        asset.safeTransferFrom(msg.sender, address(this), assets);
        shares[msg.sender] += minted;
        totalShares += minted;
    }

    function redeem(uint256 sh) external returns (uint256 paid) {
        paid = _convertToAssets(sh);
        shares[msg.sender] -= sh;
        totalShares -= sh;
        asset.safeTransfer(msg.sender, paid);
    }
}
