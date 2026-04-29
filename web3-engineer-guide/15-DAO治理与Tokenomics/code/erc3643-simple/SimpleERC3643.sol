// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title SimpleERC3643 — 极简许可型代币
/// @notice 教学版本：演示 ERC-3643 / T-REX 的核心思想——"transfer 必须双方都 verified"
///         真生产版应使用完整 T-REX 库（IdentityRegistry + Compliance + ONCHAINID）
/// @dev 真实 ERC-3643 标准包含：
///      - Identity Registry（KYC 注册表）
///      - Compliance Module（业务规则：转账上限 / 地理 / 黑名单）
///      - ONCHAINID（去中心化身份合约）
///      - Forced Transfer / Pause / Recovery
contract SimpleERC3643 is ERC20 {
    address public agent;
    bool public paused;

    mapping(address => bool) public verified;
    mapping(address => bool) public frozen;

    /// @dev forcedTransfer 期间临时置 true，让 _update 跳过 from 的 frozen 检查
    bool private _bypassFrozen;

    event AgentChanged(address indexed newAgent);
    event Verified(address indexed user, bool status);
    event Frozen(address indexed user, bool status);
    event Paused(bool status);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount);

    error NotAgent();
    error NotVerified(address account);
    error AccountFrozen(address account);
    error TokenPaused();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(string memory name_, string memory symbol_, address _agent)
        ERC20(name_, symbol_)
    {
        agent = _agent;
        verified[_agent] = true;
        emit AgentChanged(_agent);
    }

    // -- compliance setters --

    function setVerified(address user, bool status) external onlyAgent {
        verified[user] = status;
        emit Verified(user, status);
    }

    function setFrozen(address user, bool status) external onlyAgent {
        frozen[user] = status;
        emit Frozen(user, status);
    }

    function setPaused(bool status) external onlyAgent {
        paused = status;
        emit Paused(status);
    }

    function setAgent(address newAgent) external onlyAgent {
        agent = newAgent;
        verified[newAgent] = true;
        emit AgentChanged(newAgent);
    }

    // -- mint / burn / forced transfer (agent-only) --

    function mint(address to, uint256 amount) external onlyAgent {
        if (!verified[to]) revert NotVerified(to);
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyAgent {
        _burn(from, amount);
    }

    /// @notice 监管 / 法院命令下的强制转账（Securitize、Sky RWA Vault 都有此权限）
    function forcedTransfer(address from, address to, uint256 amount) external onlyAgent {
        if (!verified[to]) revert NotVerified(to);
        // 跳过 from 的 frozen 检查（监管强制）；to 的 frozen 检查仍保留
        _bypassFrozen = true;
        _transfer(from, to, amount);
        _bypassFrozen = false;
        emit ForcedTransfer(from, to, amount);
    }

    // -- core hook：transfer 前校验 --

    /// @dev OZ 5.x 用 _update（4.x 用 _beforeTokenTransfer）
    function _update(address from, address to, uint256 amount) internal override {
        if (paused) revert TokenPaused();

        // mint (from = 0) / burn (to = 0) 跳过 verified 检查
        if (from != address(0)) {
            if (!_bypassFrozen && frozen[from]) revert AccountFrozen(from);
            if (!verified[from]) revert NotVerified(from);
        }
        if (to != address(0)) {
            if (frozen[to]) revert AccountFrozen(to);
            if (!verified[to]) revert NotVerified(to);
        }

        super._update(from, to, amount);
    }
}
