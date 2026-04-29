// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title 治理代币：ERC20 + Permit + Votes
/// @notice 核心要点：
///         1. ERC20Votes 自带 delegate / getPastVotes 用于 OZ Governor 快照投票
///         2. 用户必须显式 delegate（包括 self-delegate）才有投票权
///         3. _update / nonces 是 OZ 5.x 多重继承必须 override
contract MyGovToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    constructor(string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
        Ownable(msg.sender)
    {
        // 初始 mint 1 亿代币给部署者
        _mint(msg.sender, 100_000_000 * 1e18);
    }

    /// @dev OZ 5.x 用 _update（4.x 是 _beforeTokenTransfer / _afterTokenTransfer）
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    /// @notice 仅 owner 可继续 mint（生产应交给 governance / 取消）
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
