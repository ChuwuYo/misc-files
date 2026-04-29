// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice 教学用：UniswapV2 风格 AMM。0.3% 手续费、constant product、PUSH 模式。
/// 学习目的：理解 reserve vs balance 推算、sqrt LP、MINIMUM_LIQUIDITY、k-invariant 检查。
interface IUniswapV2Callee {
    function uniswapV2Call(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external;
}

library Math {
    function min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }

    /// @notice Babylonian 平方根。来自 UniswapV2 官方实现。
    function sqrt(uint256 y) internal pure returns (uint256 z) {
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

contract MyPair is ERC20, ReentrancyGuard {
    /// @notice 永久锁仓的最小流动性，避免 inflation attack 让首位 LP 拿到天价 share。
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    address public immutable token0;
    address public immutable token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(address _t0, address _t1) ERC20("My UniV2 LP", "MYV2") {
        require(_t0 != _t1 && _t0 != address(0) && _t1 != address(0), "BAD_TOKENS");
        token0 = _t0;
        token1 = _t1;
    }

    function getReserves() public view returns (uint112 _r0, uint112 _r1, uint32 _ts) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function _update(uint256 balance0, uint256 balance1, uint112 _r0, uint112 _r1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "OVERFLOW");
        uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
        uint32 timeElapsed;
        unchecked {
            timeElapsed = blockTimestamp - blockTimestampLast;
        }
        if (timeElapsed > 0 && _r0 != 0 && _r1 != 0) {
            // TWAP 累加器：price = reserveOther / reserveSelf，scaled by 2**112
            unchecked {
                price0CumulativeLast += (uint256(_r1) * 2 ** 112 / _r0) * timeElapsed;
                price1CumulativeLast += (uint256(_r0) * 2 ** 112 / _r1) * timeElapsed;
            }
        }
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    /// @notice 添加流动性。调用者必须先把 token0/token1 transfer 进 pair 再调用。
    function mint(address to) external nonReentrant returns (uint256 liquidity) {
        (uint112 _r0, uint112 _r1,) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _r0;
        uint256 amount1 = balance1 - _r1;

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY);
        } else {
            liquidity = Math.min(amount0 * _totalSupply / _r0, amount1 * _totalSupply / _r1);
        }
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);
        _update(balance0, balance1, _r0, _r1);
        emit Mint(msg.sender, amount0, amount1);
    }

    /// @notice 移除流动性。调用者需先把自己的 LP token transfer 进 pair。
    function burn(address to) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        (uint112 _r0, uint112 _r1,) = getReserves();
        address _t0 = token0;
        address _t1 = token1;
        uint256 balance0 = IERC20(_t0).balanceOf(address(this));
        uint256 balance1 = IERC20(_t1).balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));

        uint256 _totalSupply = totalSupply();
        amount0 = liquidity * balance0 / _totalSupply;
        amount1 = liquidity * balance1 / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_LIQUIDITY_BURNED");
        _burn(address(this), liquidity);
        require(IERC20(_t0).transfer(to, amount0), "T0_TRANSFER_FAIL");
        require(IERC20(_t1).transfer(to, amount1), "T1_TRANSFER_FAIL");
        balance0 = IERC20(_t0).balanceOf(address(this));
        balance1 = IERC20(_t1).balanceOf(address(this));
        _update(balance0, balance1, _r0, _r1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    /// @notice 兑换。PUSH 模式：调用者必须在 swap 调用前/中（flash callback 内）把 input transfer 进 pair。
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _r0, uint112 _r1,) = getReserves();
        require(amount0Out < _r0 && amount1Out < _r1, "INSUFFICIENT_LIQUIDITY");

        uint256 balance0;
        uint256 balance1;
        {
            address _t0 = token0;
            address _t1 = token1;
            require(to != _t0 && to != _t1, "INVALID_TO");
            if (amount0Out > 0) require(IERC20(_t0).transfer(to, amount0Out), "T0_OUT_FAIL");
            if (amount1Out > 0) require(IERC20(_t1).transfer(to, amount1Out), "T1_OUT_FAIL");
            if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
            balance0 = IERC20(_t0).balanceOf(address(this));
            balance1 = IERC20(_t1).balanceOf(address(this));
        }
        uint256 amount0In = balance0 > _r0 - amount0Out ? balance0 - (_r0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _r1 - amount1Out ? balance1 - (_r1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "INSUFFICIENT_INPUT_AMOUNT");
        {
            // 0.3% 手续费：扣 input 的 3/1000，比较调整后 k 是否不下降
            uint256 balance0Adjusted = balance0 * 1000 - amount0In * 3;
            uint256 balance1Adjusted = balance1 * 1000 - amount1In * 3;
            require(balance0Adjusted * balance1Adjusted >= uint256(_r0) * _r1 * 1000 ** 2, "K");
        }
        _update(balance0, balance1, _r0, _r1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
}
