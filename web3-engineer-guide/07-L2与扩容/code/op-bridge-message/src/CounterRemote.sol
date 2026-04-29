// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ICrossDomainMessenger {
    function sendMessage(address _target, bytes calldata _message, uint32 _minGasLimit) external;
    function xDomainMessageSender() external view returns (address);
}

/// @title CounterRemote - 接收来自 L1 的跨域消息触发 increment 的 Counter
contract CounterRemote {
    uint256 public number;
    address public immutable messenger;
    address public immutable l1Sender; // 期望的 L1 调用者

    error UnauthorizedMessenger();
    error UnauthorizedL1Sender();

    constructor(address _messenger, address _l1Sender) {
        messenger = _messenger;
        l1Sender = _l1Sender;
    }

    /// @notice 仅接受来自 L1CrossDomainMessenger 的、且 xDomainMessageSender 是 l1Sender 的调用
    function increment() external {
        if (msg.sender != messenger) revert UnauthorizedMessenger();
        if (ICrossDomainMessenger(messenger).xDomainMessageSender() != l1Sender)
            revert UnauthorizedL1Sender();
        unchecked {
            number++;
        }
    }
}
