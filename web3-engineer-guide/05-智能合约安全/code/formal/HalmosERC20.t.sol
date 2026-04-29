// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title 用 Halmos 形式化证明：transfer 不会改变 totalSupply
/// 用法：halmos --contract HalmosTotalSupplyTest
contract Toy is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}

contract HalmosTotalSupplyTest is Test {
    Toy token;

    function setUp() public {
        token = new Toy();
    }

    /// Halmos 把 src/dst/amt/initialSupply 都当作符号变量穷举。
    function check_transfer_preserves_total_supply(
        address src,
        address dst,
        uint256 amt,
        uint256 initialSupply
    ) public {
        vm.assume(src != address(0));
        vm.assume(dst != address(0));
        vm.assume(initialSupply <= 1e30); // 限缩搜索空间
        token.mint(src, initialSupply);
        uint256 before = token.totalSupply();

        vm.prank(src);
        // src 没钱时 transfer revert，符号执行会自动分支
        try token.transfer(dst, amt) returns (bool) {} catch {}

        uint256 afterSupply = token.totalSupply();
        assertEq(afterSupply, before, "totalSupply must not change on transfer");
    }
}
