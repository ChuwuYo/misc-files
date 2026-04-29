// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

/// @notice Foundry 部署脚本：把 Counter 部署到当前 RPC 指向的链
/// @dev 用 forge script script/Deploy.s.sol --rpc-url <chain> --broadcast 跑
contract Deploy is Script {
    function run() external returns (Counter c) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        c = new Counter();
        // 跑一次 increment，记录 gas
        c.increment();
        vm.stopBroadcast();

        console2.log("Counter deployed at:", address(c));
        console2.log("Block number:", block.number);
        console2.log("Block timestamp:", block.timestamp);
    }
}
