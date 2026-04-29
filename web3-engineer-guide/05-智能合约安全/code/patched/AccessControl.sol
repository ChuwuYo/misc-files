// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title 修复版（非升级合约）：用 constructor 直接设置 owner
/// @notice 非可升级钱包，部署时即把 owner 设给 _owner，无需 initialize 模式。
/// 如果要做可升级版本，应整体改用 OwnableUpgradeable + Initializable，
/// 这里走 patched/ 的"防御版"教学路线，选最简单清晰的非升级方案。
contract SafeWallet is Ownable {
    constructor(address _owner) Ownable(_owner) {}

    function execute(address to, bytes calldata data) external payable onlyOwner {
        (bool ok, ) = to.call{value: msg.value}(data);
        require(ok, "fail");
    }

    receive() external payable {}
}

/// @title 修复版 implementation：禁止初始化 + 移除 selfdestruct
contract SafeProxyImpl is Initializable {
    address public admin;
    uint256 public dataSlot;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _admin) external initializer {
        admin = _admin;
    }
    // 注意：故意不写 selfdestruct，Cancun 后即便写了也只清账户余额而不删代码，
    // 但 Munchables 教训是：依然要在 implementation 上隔绝 admin 之外的写权限。
}
