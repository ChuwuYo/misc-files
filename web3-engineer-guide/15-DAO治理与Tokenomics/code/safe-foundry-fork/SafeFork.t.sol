// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";

/// @notice 接口对应 Safe（Gnosis Safe）核心 ABI
interface ISafe {
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function nonce() external view returns (uint256);
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures
    ) external payable returns (bool success);
    function isOwner(address) external view returns (bool);
}

/// @notice 教学示例：在 Mainnet fork 上 inspect 一个真实 Safe
/// @dev 运行：MAINNET_RPC_URL=https://... forge test --match-path "*SafeFork*"
///      可换成任何已知 Safe 地址（如 Lido、Optimism、Uniswap Foundation 多签）
contract SafeForkTest is Test {
    // 例子：Optimism Foundation Multisig
    address constant SAFE = 0x2501c477D0A35545a387Aa4A3EEe4292A9a8B3F0;

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
    }

    function test_InspectSafe_owners_threshold() public {
        if (block.chainid != 1) return; // 没 fork 就跳过
        ISafe safe = ISafe(SAFE);
        address[] memory owners = safe.getOwners();
        uint256 threshold = safe.getThreshold();

        console.log("Safe address:", SAFE);
        console.log("Threshold:   ", threshold);
        console.log("Owner count: ", owners.length);
        for (uint256 i = 0; i < owners.length; i++) {
            console.log("  owner", i, owners[i]);
        }

        assertGt(owners.length, 0);
        assertLe(threshold, owners.length);
    }
}
