// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title MyTokenUUPS — UUPS 模式可升级 ERC20
/// @notice 注意：从 OZ v5.5 起 UUPSUpgradeable / Initializable 来自 contracts 包而非 contracts-upgradeable
contract MyTokenUUPS is Initializable, ERC20Upgradeable, ERC20PermitUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // 防止实现合约本身被初始化
    }

    function initialize(string memory name_, string memory symbol_, address owner_) external initializer {
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @dev 升级权限闸门：仅 owner 可触发 _upgradeToAndCall
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice 演示 storage gap：v2 添加新变量时务必从 gap 切片
    /// @dev 留 50 个 slot 给后续扩展，避免破坏继承链下游 storage layout
    uint256[50] private __gap;
}

/// @notice 升级测试用 V2，添加新方法但保持 storage layout 兼容
contract MyTokenUUPSV2 is MyTokenUUPS {
    function version() external pure returns (string memory) {
        return "v2";
    }
}
