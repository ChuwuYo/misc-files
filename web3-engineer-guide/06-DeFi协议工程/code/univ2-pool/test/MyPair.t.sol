// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MyPair} from "../src/MyPair.sol";

contract MockToken is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MyPairTest is Test {
    MockToken internal t0;
    MockToken internal t1;
    MyPair internal pair;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        MockToken a = new MockToken("Token A", "A");
        MockToken b = new MockToken("Token B", "B");
        // 保证 token0 < token1，符合 UniV2 习惯（虽然教学合约不强制）
        if (address(a) < address(b)) {
            t0 = a;
            t1 = b;
        } else {
            t0 = b;
            t1 = a;
        }
        pair = new MyPair(address(t0), address(t1));

        t0.mint(alice, 1_000_000 ether);
        t1.mint(alice, 1_000_000 ether);
        t0.mint(bob, 1_000_000 ether);
        t1.mint(bob, 1_000_000 ether);
    }

    /// @notice 首次 mint：LP = sqrt(a0 * a1) - 1000，1000 锁在 0xdead。
    function test_FirstMint() public {
        uint256 amt0 = 100 ether;
        uint256 amt1 = 400 ether;

        vm.startPrank(alice);
        t0.transfer(address(pair), amt0);
        t1.transfer(address(pair), amt1);
        uint256 lp = pair.mint(alice);
        vm.stopPrank();

        uint256 expected = _sqrt(amt0 * amt1) - 1000;
        assertEq(lp, expected, "first LP wrong");
        assertEq(pair.balanceOf(alice), expected);
        assertEq(pair.balanceOf(address(0xdead)), 1000, "dead share missing");

        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertEq(r0, amt0);
        assertEq(r1, amt1);
    }

    /// @notice 后续 mint 按比例分 LP。
    function test_SubsequentMint() public {
        // alice 首存
        vm.startPrank(alice);
        t0.transfer(address(pair), 100 ether);
        t1.transfer(address(pair), 400 ether);
        pair.mint(alice);
        vm.stopPrank();

        uint256 supplyBefore = pair.totalSupply();

        // bob 同比例存 1/10
        vm.startPrank(bob);
        t0.transfer(address(pair), 10 ether);
        t1.transfer(address(pair), 40 ether);
        uint256 lp = pair.mint(bob);
        vm.stopPrank();

        // 预期 bob 拿到约 supplyBefore * 1/10
        assertApproxEqRel(lp, supplyBefore / 10, 1e15, "subsequent mint ratio off");
    }

    /// @notice swap 0.3% 手续费 + k-invariant 不变。
    function test_SwapAndKInvariant() public {
        // 初始流动性：100 t0, 400 t1
        vm.startPrank(alice);
        t0.transfer(address(pair), 100 ether);
        t1.transfer(address(pair), 400 ether);
        pair.mint(alice);
        vm.stopPrank();

        (uint112 r0Before, uint112 r1Before,) = pair.getReserves();
        uint256 kBefore = uint256(r0Before) * uint256(r1Before);

        // bob 用 1 个 t0 换 t1：根据 0.3% 手续费公式
        // amountInWithFee = 1e18 * 997
        // out = (amountInWithFee * r1) / (r0 * 1000 + amountInWithFee)
        uint256 amountIn = 1 ether;
        uint256 amountInWithFee = amountIn * 997;
        uint256 expectedOut = (amountInWithFee * r1Before) / (uint256(r0Before) * 1000 + amountInWithFee);

        vm.startPrank(bob);
        t0.transfer(address(pair), amountIn);
        pair.swap(0, expectedOut, bob, "");
        vm.stopPrank();

        (uint112 r0After, uint112 r1After,) = pair.getReserves();
        uint256 kAfter = uint256(r0After) * uint256(r1After);

        // K 必须不降（手续费让 k 实际略涨）
        assertGe(kAfter, kBefore, "K decreased");
        // bob 的 t1 余额从 1_000_000 ether 涨到 1_000_000 ether + expectedOut
        assertEq(t1.balanceOf(bob), 1_000_000 ether + expectedOut, "bob t1 balance off");
        // reserve 同步更新
        assertEq(r0After, r0Before + amountIn);
        assertEq(r1After, r1Before - expectedOut);
    }

    /// @notice 拿不出多于池子的 reserve。
    function test_RevertWhenSwapTooMuch() public {
        vm.startPrank(alice);
        t0.transfer(address(pair), 100 ether);
        t1.transfer(address(pair), 400 ether);
        pair.mint(alice);
        vm.stopPrank();

        vm.startPrank(bob);
        t0.transfer(address(pair), 1 ether);
        vm.expectRevert(bytes("INSUFFICIENT_LIQUIDITY"));
        pair.swap(0, 500 ether, bob, "");
        vm.stopPrank();
    }

    /// @notice 不付费想白嫖：K 检查会 revert。
    function test_RevertWhenNoInput() public {
        vm.startPrank(alice);
        t0.transfer(address(pair), 100 ether);
        t1.transfer(address(pair), 400 ether);
        pair.mint(alice);
        vm.stopPrank();

        // bob 啥也没送进去，直接想拿 1 个 t1
        vm.prank(bob);
        vm.expectRevert(bytes("INSUFFICIENT_INPUT_AMOUNT"));
        pair.swap(0, 1 ether, bob, "");
    }

    /// @notice burn：移除流动性按比例返还 t0/t1。
    function test_Burn() public {
        vm.startPrank(alice);
        t0.transfer(address(pair), 100 ether);
        t1.transfer(address(pair), 400 ether);
        uint256 lp = pair.mint(alice);

        // alice 把所有 LP 还回 pair 然后 burn
        pair.transfer(address(pair), lp);
        (uint256 a0, uint256 a1) = pair.burn(alice);
        vm.stopPrank();

        // 因为 1000 wei 锁了，回来的会比原始投入略少
        assertGt(a0, 0);
        assertGt(a1, 0);
        assertLt(a0, 100 ether);
        assertLt(a1, 400 ether);
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
