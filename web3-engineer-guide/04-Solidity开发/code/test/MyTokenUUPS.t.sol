// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MyTokenUUPS, MyTokenUUPSV2} from "../src/MyTokenUUPS.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice UUPS 升级流程的端到端测试
contract MyTokenUUPSTest is Test {
    MyTokenUUPS internal impl;
    MyTokenUUPS internal proxied; // 通过 proxy 调用的实例
    address internal owner = address(0xA11CE);

    function setUp() public {
        // 1. 部署实现合约（不可被外部初始化）
        impl = new MyTokenUUPS();

        // 2. 部署 ERC1967Proxy 并 atomic 调用 initialize
        bytes memory initData =
            abi.encodeCall(MyTokenUUPS.initialize, ("UpgradableToken", "UPT", owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        // 3. 把 proxy 地址 cast 成实现接口供后续调用
        proxied = MyTokenUUPS(address(proxy));
    }

    function test_initialize_setsOwner() public view {
        assertEq(proxied.owner(), owner);
        assertEq(proxied.name(), "UpgradableToken");
    }

    function test_revert_doubleInitialize() public {
        vm.expectRevert();
        proxied.initialize("x", "x", owner);
    }

    function test_upgradeToV2_preservesState() public {
        vm.prank(owner);
        proxied.mint(owner, 100 ether);
        assertEq(proxied.balanceOf(owner), 100 ether);

        // 部署 V2 实现并通过 owner 触发升级
        MyTokenUUPSV2 v2Impl = new MyTokenUUPSV2();
        vm.prank(owner);
        proxied.upgradeToAndCall(address(v2Impl), "");

        // 状态保留
        assertEq(proxied.balanceOf(owner), 100 ether);
        // 新接口可调用
        assertEq(MyTokenUUPSV2(address(proxied)).version(), "v2");
    }

    function test_revert_upgrade_byNonOwner() public {
        MyTokenUUPSV2 v2Impl = new MyTokenUUPSV2();
        vm.expectRevert();
        vm.prank(address(0xBAD));
        proxied.upgradeToAndCall(address(v2Impl), "");
    }
}
