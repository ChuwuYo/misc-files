// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @title 未保护的 init：还原 Parity Multisig (2017-11-06) 凶案
/// @notice 历史损失：约 51.4 万 ETH（约 1.55 亿美元）被永久冻结。
/// 漏洞要点：library/implementation 合约部署后 initWallet 没人调用，
/// 攻击者直接调用使自己成为 owner，再调用 selfdestruct（kill）把库炸了。
contract VulnerableWallet {
    address public owner;
    bool public initialized;

    function initWallet(address _owner) external {
        // 漏洞 #1：没有 initialized 检查，谁都能 init。
        owner = _owner;
        initialized = true;
    }

    /// @dev 漏洞 #2：把 selfdestruct 暴露给 onlyOwner，但 owner 可以被任何人重置。
    function kill() external {
        require(msg.sender == owner, "not owner");
        selfdestruct(payable(msg.sender));
    }

    function execute(address to, bytes calldata data) external payable {
        require(msg.sender == owner, "not owner");
        (bool ok, ) = to.call{value: msg.value}(data);
        require(ok, "fail");
    }
}

/// @title 未保护 implementation 的 selfdestruct：还原 Munchables（2024-03-26，6200 万美元）
/// 与 Audius（2022-07）的存储槽劫持模式。
contract VulnerableProxyImpl {
    address public admin;
    uint256 public dataSlot;

    function init(address _admin) external {
        admin = _admin; // 漏洞：可被反复调用
    }

    function selfDestructIt() external {
        require(msg.sender == admin, "not admin");
        selfdestruct(payable(msg.sender));
    }
}
