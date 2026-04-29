# 练习 02：预言机操纵审计

## 题目

下面是一个简化的借贷合约 `BadLending.sol`，有严重的预言机漏洞。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112, uint112, uint32);
    function token0() external view returns (address);
}

/// @notice 教学版：故意写漏洞百出的借贷合约
contract BadLending {
    IERC20 public immutable usdc;          // 借出资产
    IERC20 public immutable collateral;    // 抵押资产（如 SOMETOKEN）
    IUniswapV2Pair public immutable pair;  // SOMETOKEN/USDC Uniswap V2 池
    uint256 public constant LTV = 70;      // 70%

    mapping(address => uint256) public collateralOf;
    mapping(address => uint256) public debtOf;

    constructor(IERC20 _usdc, IERC20 _coll, IUniswapV2Pair _pair) {
        usdc = _usdc;
        collateral = _coll;
        pair = _pair;
    }

    /// @notice 用 V2 spot price 估值
    function priceOfCollateral() public view returns (uint256) {
        (uint112 r0, uint112 r1, ) = pair.getReserves();
        // 假设 token0 = collateral, token1 = USDC（生产代码必须判断顺序，这里简化）
        return uint256(r1) * 1e18 / uint256(r0);  // USDC per collateral, 1e18 scale
    }

    function deposit(uint256 amt) external {
        collateral.transferFrom(msg.sender, address(this), amt);
        collateralOf[msg.sender] += amt;
    }

    function borrow(uint256 amt) external {
        uint256 collValue = collateralOf[msg.sender] * priceOfCollateral() / 1e18;
        uint256 maxBorrow = collValue * LTV / 100;
        require(debtOf[msg.sender] + amt <= maxBorrow, "EXCEEDS_LTV");
        debtOf[msg.sender] += amt;
        usdc.transfer(msg.sender, amt);
    }

    function liquidate(address borrower) external {
        uint256 collValue = collateralOf[borrower] * priceOfCollateral() / 1e18;
        require(debtOf[borrower] * 100 > collValue * LTV, "HEALTHY");
        // 清算者偿还债务，拿走全部抵押品（10% 折扣）
        usdc.transferFrom(msg.sender, address(this), debtOf[borrower]);
        uint256 collOut = collateralOf[borrower];
        debtOf[borrower] = 0;
        collateralOf[borrower] = 0;
        collateral.transfer(msg.sender, collOut);
    }
}
```

## 任务

### Part A：找出至少 2 个攻击向量

1. **第一个攻击向量提示**：闪电贷 → 操纵 V2 spot price 拉高/拉低 → 借出超额 USDC / 自己清算自己。
2. **第二个攻击向量**：低流动性池被几个大户掌控时，少量 swap 就能让 spot 跳动 20%+，可以用 sandwich 攻击受害者借款。

### Part B：写攻击 PoC（Foundry 测试）

骨架（你来填空）：

```solidity
// test/Attack.t.sol
function test_FlashLoanAttack() public {
    // 1. 部署 BadLending + Mock token + Mock UniV2Pair
    // 2. 借 10M USDC 闪电贷
    // 3. 在 UniV2Pair 用 USDC swap 出大量 collateral，把 collateral 价格压低 80%
    // 4. 用 100 collateral deposit 到 BadLending，按"操纵后低价"得到的 maxBorrow 极小
    //    —— 攻击点 1 不成立，换思路
    //
    // 替代向量：
    // 3'. 在 UniV2Pair swap collateral → USDC，把 collateral 价格拉高 5x
    // 4'. 用 1 collateral deposit，按"操纵后高价" maxBorrow = 5 * LTV
    // 5'. borrow 5 USDC 出来
    // 6'. 反向 swap 把价格拉回，还闪电贷
    // 净利 = borrowed_USDC - 闪电贷利息 - 滑点
    assertTrue(true);
}
```

### Part C：写修复版本

提示：用 V2 cumulative price 做 30 分钟 TWAP；加深度阈值（reserve 必须 > X）；高级版叠 Chainlink。

骨架：

```solidity
contract GoodLending {
    // ... 同上 ...

    uint256 public lastCumulative;
    uint256 public lastTimestamp;
    uint256 public lastTwap;
    uint256 public constant TWAP_PERIOD = 1800;  // 30 min

    AggregatorV3Interface public chainlinkFeed;  // backup oracle

    function _updateTwap() internal {
        uint256 cumulative = pair.price0CumulativeLast();  // V2 oracle 累积值
        uint256 elapsed = block.timestamp - lastTimestamp;
        if (elapsed >= TWAP_PERIOD) {
            lastTwap = (cumulative - lastCumulative) / elapsed;
            lastCumulative = cumulative;
            lastTimestamp = block.timestamp;
        }
    }

    function priceOfCollateral() public view returns (uint256) {
        uint256 twap = lastTwap;  // 30min TWAP
        // 与 Chainlink 二次校验
        (, int256 chainlinkAns, , uint256 updated, ) = chainlinkFeed.latestRoundData();
        require(block.timestamp - updated < 3600, "STALE");
        uint256 chainlinkPrice = uint256(chainlinkAns);  // 调整 decimals
        // 如果 twap 与 chainlink 差距 > 5%，revert（可能被攻击中）
        require(_within5Percent(twap, chainlinkPrice), "PRICE_DEVIATION");
        // 加深度阈值
        (uint112 r0, uint112 r1, ) = pair.getReserves();
        require(uint256(r0) > 100_000e18, "LOW_LIQ");
        return twap;
    }

    function _within5Percent(uint a, uint b) internal pure returns (bool) {
        if (a > b) return (a - b) * 100 / b <= 5;
        return (b - a) * 100 / b <= 5;
    }
}
```

### Part D：分析

1. 为什么"30 分钟 TWAP"不能完全杜绝操纵？给出一个能在 TWAP 周期内放大攻击的场景。
2. Chainlink + TWAP 二次校验有什么残余风险？
3. 如果你想让协议**真正抗操纵**，最后一道防线是什么？（提示：和 Aave V3 isolation mode 类似）

## 参考答案要点

- TWAP 不能杜绝操纵：如果池子流动性极小且攻击者愿意烧很多手续费，可以连续 30+ 分钟保持操纵价。
- Chainlink + TWAP 残余风险：Chainlink 自己被某个数据源（如 Coinbase）操纵，所有节点信号一致出错。
- 终极防线：**加 isolated mode + borrow cap**——某个抵押品总借款上限封顶，让攻击者就算操纵成功也只能偷有限金额。
