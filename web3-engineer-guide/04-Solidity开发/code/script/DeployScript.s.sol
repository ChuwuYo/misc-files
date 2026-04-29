// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MyToken} from "../src/MyToken.sol";
import {MyTokenUUPS} from "../src/MyTokenUUPS.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice 部署脚本：同时部署普通 ERC20 与 UUPS 可升级 ERC20
/// @dev 跑法：
///   forge script script/DeployScript.s.sol:DeployScript \
///     --rpc-url $SEPOLIA_RPC_URL \
///     --private-key $PRIVATE_KEY \
///     --broadcast --verify
contract DeployScript is Script {
    function run() external returns (MyToken token, address uupsProxy) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        // 1. 普通 ERC20
        token = new MyToken("MyToken", "MTK", 1_000_000 ether, deployer);
        console2.log("MyToken at:", address(token));

        // 2. UUPS 实现 + ERC1967 代理
        MyTokenUUPS impl = new MyTokenUUPS();
        bytes memory initData =
            abi.encodeCall(MyTokenUUPS.initialize, ("UpgradableToken", "UPT", deployer));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        uupsProxy = address(proxy);
        console2.log("UUPS impl at:", address(impl));
        console2.log("UUPS proxy at:", uupsProxy);

        vm.stopBroadcast();
    }
}
