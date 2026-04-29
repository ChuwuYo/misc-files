// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

interface IL1CrossDomainMessenger {
    function sendMessage(address _target, bytes calldata _message, uint32 _minGasLimit) external;
}

contract SendL1ToL2 is Script {
    // Sepolia 上的 OP Stack 跨域 messenger（截至 2026-04，请以 Optimism docs 为准）
    address constant L1_MESSENGER = 0x58Cc85b8D04EA49cC6DBd3CbFFd00B4B8D6cb3ef;

    function run() external {
        address counterRemote = vm.envAddress("L2_COUNTER_REMOTE");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        IL1CrossDomainMessenger(L1_MESSENGER).sendMessage(
            counterRemote,
            abi.encodeWithSignature("increment()"),
            100_000
        );
        vm.stopBroadcast();

        console2.log("L1 -> L2 message sent. Watch L2 Counter.number");
    }
}
