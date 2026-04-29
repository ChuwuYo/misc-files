# UniV2-Style Pool（教学复刻）

从零实现一个 UniswapV2 兼容池子，对比官方 `UniswapV2Pair` 的 gas 开销。

## 学习目标

- 理解 PUSH 模式（balance vs reserve 推算输入）
- 实现 sqrt LP 份额 + MINIMUM_LIQUIDITY
- 实现 flash swap callback
- 用 `forge snapshot` 比较 gas

## 运行

```bash
# 首次需要安装依赖（OpenZeppelin v5.5 + forge-std）
forge install OpenZeppelin/openzeppelin-contracts@v5.5.0 --no-commit
forge install foundry-rs/forge-std --no-commit
forge build
forge test -vv
forge snapshot --diff   # 可选：与官方 V2Pair gas 对比（需自行加 GasCompare.t.sol）
```

> 注：本仓库默认 **没有** `lib/` 目录，依赖按需安装。`pragma 0.8.28`、OZ v5.5。
> 真实运行版本是 `src/MyPair.sol` + `test/MyPair.t.sol`，下方代码块仅作教学展示，可能与最新源码略有差异。

## 文件结构

```
univ2-pool/
├── foundry.toml
├── remappings.txt
├── src/
│   └── MyPair.sol         # 教学版池子（TWAP 累加器内联，无独立 UQ 库）
├── test/
│   └── MyPair.t.sol       # 单元测试：mint / burn / swap / k-invariant
└── README.md
```

## 关键合约骨架

`src/MyPair.sol`：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUniswapV2Callee {
    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external;
}

library Math {
    function min(uint x, uint y) internal pure returns (uint) {
        return x < y ? x : y;
    }
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) {
            z = 1;
        }
    }
}

contract MyPair is ERC20, ReentrancyGuard {
    uint public constant MINIMUM_LIQUIDITY = 1000;

    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32  private blockTimestampLast;

    uint public price0CumulativeLast;
    uint public price1CumulativeLast;

    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(address _t0, address _t1) ERC20("My UniV2 LP", "MYV2") {
        token0 = _t0;
        token1 = _t1;
    }

    function getReserves() public view returns (uint112 _r0, uint112 _r1, uint32 _ts) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function _update(uint balance0, uint balance1, uint112 _r0, uint112 _r1) private {
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed;
        unchecked { timeElapsed = blockTimestamp - blockTimestampLast; }
        if (timeElapsed > 0 && _r0 != 0 && _r1 != 0) {
            // 简化：用 (reserve / reserve) * timeElapsed 累加
            price0CumulativeLast += (uint(_r1) * 2**112 / _r0) * timeElapsed;
            price1CumulativeLast += (uint(_r0) * 2**112 / _r1) * timeElapsed;
        }
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    function mint(address to) external nonReentrant returns (uint liquidity) {
        (uint112 _r0, uint112 _r1,) = getReserves();
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        uint amount0 = balance0 - _r0;
        uint amount1 = balance1 - _r1;

        uint _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY);
        } else {
            liquidity = Math.min(amount0 * _totalSupply / _r0,
                                 amount1 * _totalSupply / _r1);
        }
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);
        _update(balance0, balance1, _r0, _r1);
        emit Mint(msg.sender, amount0, amount1);
    }

    function burn(address to) external nonReentrant returns (uint amount0, uint amount1) {
        (uint112 _r0, uint112 _r1,) = getReserves();
        address _t0 = token0;
        address _t1 = token1;
        uint balance0 = IERC20(_t0).balanceOf(address(this));
        uint balance1 = IERC20(_t1).balanceOf(address(this));
        uint liquidity = balanceOf(address(this));

        uint _totalSupply = totalSupply();
        amount0 = liquidity * balance0 / _totalSupply;
        amount1 = liquidity * balance1 / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_LIQUIDITY_BURNED");
        _burn(address(this), liquidity);
        IERC20(_t0).transfer(to, amount0);
        IERC20(_t1).transfer(to, amount1);
        balance0 = IERC20(_t0).balanceOf(address(this));
        balance1 = IERC20(_t1).balanceOf(address(this));
        _update(balance0, balance1, _r0, _r1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _r0, uint112 _r1,) = getReserves();
        require(amount0Out < _r0 && amount1Out < _r1, "INSUFFICIENT_LIQUIDITY");

        uint balance0;
        uint balance1;
        {
            address _t0 = token0;
            address _t1 = token1;
            require(to != _t0 && to != _t1, "INVALID_TO");
            if (amount0Out > 0) IERC20(_t0).transfer(to, amount0Out);
            if (amount1Out > 0) IERC20(_t1).transfer(to, amount1Out);
            if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
            balance0 = IERC20(_t0).balanceOf(address(this));
            balance1 = IERC20(_t1).balanceOf(address(this));
        }
        uint amount0In = balance0 > _r0 - amount0Out ? balance0 - (_r0 - amount0Out) : 0;
        uint amount1In = balance1 > _r1 - amount1Out ? balance1 - (_r1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "INSUFFICIENT_INPUT_AMOUNT");
        {
            uint balance0Adjusted = balance0 * 1000 - amount0In * 3;
            uint balance1Adjusted = balance1 * 1000 - amount1In * 3;
            require(
                balance0Adjusted * balance1Adjusted >= uint(_r0) * _r1 * 1000**2,
                "K"
            );
        }
        _update(balance0, balance1, _r0, _r1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
}
```

## 测试要点

1. **首次 mint**：检查 LP 份额 = sqrt(amount0 * amount1) - 1000，且 1000 wei 锁在 `0xdead`。
2. **inflation attack**：尝试 mint 1+1，给池子 transfer 1e18 token，再 mint 5e17——应该取整为 0 失败（如果 dead share 设置正确，至少不会让攻击划算）。
3. **K 不变性**：swap 后 `balance0 * balance1 >= reserve0 * reserve1`（扣手续费后）。
4. **flash swap**：在 callback 里再调一次 swap 套利，验证 K 仍满足。
