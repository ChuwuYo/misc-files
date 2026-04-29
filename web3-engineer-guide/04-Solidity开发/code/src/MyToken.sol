// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MyToken — 教学用 ERC20，叠加 EIP-2612 permit 与 ERC20Burnable
/// @notice 演示 OpenZeppelin v5.x 标准导入路径与 access control 模式
/// @dev 使用 AccessControl 而非 Ownable 是为了示范多角色场景；生产可按需替换
contract MyToken is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice 自定义错误比 require + string 节省字节码与运行时 gas
    error MintCapExceeded(uint256 requested, uint256 cap);

    /// @notice 单次铸造硬上限，演示 immutable 节省 SLOAD
    uint256 public immutable MINT_CAP;

    constructor(string memory name_, string memory symbol_, uint256 mintCap_, address admin_)
        ERC20(name_, symbol_)
        ERC20Permit(name_) // EIP-712 domain separator 的 name
    {
        MINT_CAP = mintCap_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, admin_);
    }

    /// @notice 仅 MINTER_ROLE 可铸造，单次不能超过 MINT_CAP
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount > MINT_CAP) revert MintCapExceeded(amount, MINT_CAP);
        _mint(to, amount);
    }
}
