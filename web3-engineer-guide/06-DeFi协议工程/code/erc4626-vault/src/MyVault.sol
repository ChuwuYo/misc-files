// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice 教学版 ERC-4626 vault：使用 OpenZeppelin v5 的 virtual shares + decimal offset
/// 来防御 inflation attack（首笔 deposit + donate 让小额存款人 share 取整为 0 的攻击）。
///
/// offset = 6 表示 share 总量在算账时会"虚拟"加上 1e6，1 wei asset 对应 1e6 virtual share，
/// 攻击者必须 donate 至少 1e6 倍受害者存款才能撼动比例 —— 经济上不划算。
contract MyVault is ERC4626 {
    constructor(IERC20 _asset) ERC20("My Vault Share", "vMY") ERC4626(_asset) {}

    /// @dev OpenZeppelin v5 默认 offset = 0。我们 override 成 6 让 inflation 不划算。
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}
