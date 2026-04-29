// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MyNFT} from "../contracts/MyNFT.sol";

/// @title Deploy MyNFT
/// @notice 用法：
///   BASE_URI="ipfs://bafy.../" OWNER=0x... forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
contract Deploy is Script {
    function run() external returns (MyNFT) {
        string memory baseURI = vm.envString("BASE_URI");
        address owner = vm.envAddress("OWNER");

        require(bytes(baseURI).length > 0, "BASE_URI required");
        require(owner != address(0), "OWNER required");

        vm.startBroadcast();
        MyNFT nft = new MyNFT(baseURI, owner);
        vm.stopBroadcast();

        console.log("MyNFT deployed at:", address(nft));
        console.log("Base URI:", baseURI);
        console.logBytes32(nft.BASE_URI_HASH());
        return nft;
    }
}
