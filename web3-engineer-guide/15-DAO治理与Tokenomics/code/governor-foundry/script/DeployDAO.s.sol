// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import {MyGovernor} from "../src/MyGovernor.sol";
import {MyGovToken} from "../src/MyGovToken.sol";
import {Treasury} from "../src/Treasury.sol";

/// @notice 部署 DAO 完整套件
///   Token (ERC20Votes) → Timelock → Governor → Treasury（owner = Timelock）
///   注意：deployer 部署后必须 renounce timelock 的 admin role
contract DeployDAO is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        // 1. 治理代币
        MyGovToken token = new MyGovToken("MyDAO", "MYD");

        // 2. Timelock
        // proposers / executors 先空，后赋权（避免循环依赖）
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0);  // 任何人可 execute

        TimelockController timelock = new TimelockController(
            2 days,        // minDelay
            proposers,
            executors,
            deployer       // 临时 admin
        );

        // 3. Governor
        MyGovernor governor = new MyGovernor(token, timelock);

        // 4. Treasury（owner = Timelock）
        Treasury treasury = new Treasury(address(timelock));

        // 5. 给 Governor proposer 角色
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(governor));

        // 6. 关键：deployer 放弃 timelock admin
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), deployer);

        // 7. （可选）转一些 token 给 treasury 作为初始国库
        token.transfer(address(treasury), 10_000_000 * 1e18);

        vm.stopBroadcast();

        console.log("Token:    ", address(token));
        console.log("Timelock: ", address(timelock));
        console.log("Governor: ", address(governor));
        console.log("Treasury: ", address(treasury));
    }
}
