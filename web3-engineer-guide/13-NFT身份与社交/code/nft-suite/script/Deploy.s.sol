// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MyNFT} from "../src/MyNFT.sol";

/// @notice 部署脚本
/// 用法：
///   PRIVATE_KEY=0x... ADMIN=0x... forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN");

        vm.startBroadcast(pk);
        MyNFT nft = new MyNFT(admin);
        console.log("MyNFT deployed at:", address(nft));
        vm.stopBroadcast();
    }
}
