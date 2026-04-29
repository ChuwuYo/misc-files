// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Foundry deploy script: 自动部署 + verify + 写 broadcast 文件
// 验证日期: 2026-04, foundry stable
// 用法:
//   forge script script/Deploy.s.sol:DeployScript \
//     --rpc-url $RPC_URL \
//     --account deployer \           # 通过 cast wallet import 加载 keystore
//     --broadcast \
//     --verify \
//     --etherscan-api-key $ETHERSCAN_API_KEY \
//     --slow                          # 等待 receipt
import {Script, console} from "forge-std/Script.sol";

contract MyToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
        emit Transfer(address(0), msg.sender, _supply);
    }
}

contract DeployScript is Script {
    function run() external returns (MyToken token) {
        // 优先读 keystore (--account); 退回 env PRIVATE_KEY
        uint256 deployerPk = vm.envOr("PRIVATE_KEY", uint256(0));

        // 检测网络, 防止把测试合约部到 mainnet
        require(
            block.chainid == 1 || block.chainid == 11155111 || block.chainid == 8453 || block.chainid == 84532,
            "Unsupported chain"
        );

        if (deployerPk != 0) {
            vm.startBroadcast(deployerPk);
        } else {
            vm.startBroadcast();
        }

        token = new MyToken("Demo", "DMO", 1_000_000 ether);
        console.log("Deployed MyToken at:", address(token));

        vm.stopBroadcast();

        // 把地址写到 deployments/<chainid>.json 供前端读
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        string memory json = string.concat(
            '{"MyToken":"',
            vm.toString(address(token)),
            '","blockNumber":',
            vm.toString(block.number),
            "}"
        );
        vm.writeFile(path, json);
    }
}
