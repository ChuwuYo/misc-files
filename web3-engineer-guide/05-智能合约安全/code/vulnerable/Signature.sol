// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title 签名重放 + ecrecover 0 地址陷阱
/// @notice 综合还原多起事件：dForce（2020）、PolyNetwork（2021，6.1 亿美元）
/// 等系列签名校验类漏洞，以及 ecrecover 在签名无效时返回 address(0) 的经典坑。
contract VulnerableClaim {
    IERC20 public immutable token;
    address public signer; // 漏洞：signer 可能被设为 address(0)

    constructor(IERC20 _t, address _signer) {
        token = _t;
        signer = _signer;
    }

    /// @dev 漏洞 #1：没有 nonce / chainId / 合约地址，签名跨链/跨合约重放。
    /// 漏洞 #2：没有校验 ecrecover != address(0)，如果 signer 被错误初始化为 0
    ///          则任何无效签名都能通过。
    /// 漏洞 #3：签名 malleability，未限制 s 在低半区。
    function claim(uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        bytes32 h = keccak256(abi.encodePacked(msg.sender, amount));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        address recovered = ecrecover(ethHash, v, r, s);
        require(recovered == signer, "bad sig"); // 若 signer == 0 且 sig 无效，recover 也是 0
        token.transfer(msg.sender, amount);
    }
}
