// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title 极简 DAO 国库
/// @notice owner 必须是 TimelockController（DAO 治理执行入口）
///         任何转账都必须经过 governor.execute() → timelock.execute() → treasury.transfer()
contract Treasury is Ownable {
    event Transferred(address indexed token, address indexed to, uint256 amount);
    event ETHTransferred(address indexed to, uint256 amount);

    constructor(address timelock) Ownable(timelock) {}

    /// @notice 接收 ETH（捐赠 / 来自其他合约）
    receive() external payable {}

    /// @notice 转 ERC20 代币
    function transferToken(address token, address to, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(to, amount), "transfer failed");
        emit Transferred(token, to, amount);
    }

    /// @notice 转 ETH
    function transferETH(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "insufficient ETH");
        (bool ok,) = to.call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit ETHTransferred(to, amount);
    }
}
