// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

/// @title StackPlay
/// @notice 极简合约，用来配合 forge test -vvvv 看 stack/memory/storage diff
contract StackPlay {
    uint256 public counter;

    /// 每次自增 1，触发一次 SSTORE
    function bump() external {
        counter += 1;
    }

    /// 演示 transient storage（EIP-1153）
    /// 同一笔 tx 内可读，跨 tx 清零
    function transientPlay() external {
        assembly {
            tstore(0, 42)              // TSTORE
            let v := tload(0)          // TLOAD
            sstore(0, v)               // 把 transient 值落到 persistent slot 0（counter）
        }
    }

    /// 演示 mcopy（EIP-5656）
    function mcopyPlay() external pure returns (bytes32) {
        bytes32 result;
        assembly {
            mstore(0x00, 0xdeadbeef)
            mcopy(0x40, 0x00, 0x20)    // 把 0x00..0x20 的 32 字节拷到 0x40
            result := mload(0x40)
        }
        return result;
    }
}
