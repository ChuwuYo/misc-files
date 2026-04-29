# Aave V3 Chainlink Liquidator（fork mainnet）

集成 Aave V3 flashloan + Chainlink price feed + Uniswap V3 swap，写一个完整的清算合约。

## 学习目标

- 理解 Aave V3 健康因子计算 + close factor 规则
- 集成 Chainlink price feed 做"预清算筛选"（避免 oracle stale）
- flash loan callback 编程模式
- 用 Foundry fork 主网测试历史清算事件

## 运行

本仓库的 `src/Liquidator.sol` 是**最小自包含框架**（本地 interface，可直接编译），
完整 fork 测试需要安装真实依赖：

```bash
# 最小烟雾测试（编译 + 部署）
forge install OpenZeppelin/openzeppelin-contracts@v5.5.0 --no-commit
forge install foundry-rs/forge-std --no-commit
forge build
forge test -vv

# 真实 fork 测试（需要进一步安装 aave-v3-core / uniswap-v3-periphery / chainlink）
forge test --fork-url $MAINNET_RPC_URL --fork-block-number 19500000 -vvv
```

`19500000` 是一个示例区块（2024 年 Q1）。要复现 2024-08 那波 ETH 暴跌的清算潮，可以 fork `20570000`。

## 合约骨架

`src/Liquidator.sol`：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPool} from "@aave/v3-core/contracts/interfaces/IPool.sol";
import {IFlashLoanSimpleReceiver} from "@aave/v3-core/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol";
import {IPoolAddressesProvider} from "@aave/v3-core/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract Liquidator is IFlashLoanSimpleReceiver {
    IPool public immutable POOL;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    ISwapRouter public immutable swapRouter;
    address public owner;

    constructor(address provider, address router) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(IPoolAddressesProvider(provider).getPool());
        swapRouter = ISwapRouter(router);
        owner = msg.sender;
    }

    /// @notice 入口：检查 + 触发清算
    function liquidate(
        address borrower,
        address collateralAsset,
        address debtAsset,
        uint256 debtToCover,
        AggregatorV3Interface priceFeed,
        uint24 swapFeeTier
    ) external {
        require(msg.sender == owner, "NOT_OWNER");

        // 1. 预言机 staleness check
        (, int256 ans, , uint256 updated, ) = priceFeed.latestRoundData();
        require(ans > 0 && block.timestamp - updated < 3600, "STALE_PRICE");

        // 2. 校验 HF<1（链上读 Aave 状态）
        (, , , , , uint256 hf) = POOL.getUserAccountData(borrower);
        require(hf < 1e18, "HEALTHY");

        // 3. 借闪电贷调用 executeOperation
        bytes memory params = abi.encode(borrower, collateralAsset, debtAsset, swapFeeTier);
        POOL.flashLoanSimple(address(this), debtAsset, debtToCover, params, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address /* initiator */,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "NOT_POOL");
        (address borrower, address collateralAsset, address debtAsset, uint24 fee) =
            abi.decode(params, (address, address, address, uint24));
        require(asset == debtAsset, "WRONG_ASSET");

        // 1. 授权 Aave Pool 用 debt asset 还债
        IERC20(debtAsset).approve(address(POOL), amount);

        // 2. 触发清算
        POOL.liquidationCall(collateralAsset, debtAsset, borrower, amount, false);

        // 3. 把抵押品换回 debt asset
        uint256 collBal = IERC20(collateralAsset).balanceOf(address(this));
        IERC20(collateralAsset).approve(address(swapRouter), collBal);
        swapRouter.exactInputSingle(ISwapRouter.ExactInputSingleParams({
            tokenIn: collateralAsset,
            tokenOut: debtAsset,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: collBal,
            amountOutMinimum: 0,  // 教学简化，生产应该算最小可接受
            sqrtPriceLimitX96: 0
        }));

        // 4. 还闪电贷
        uint256 owed = amount + premium;
        IERC20(debtAsset).approve(address(POOL), owed);

        // 5. 利润转给 owner
        uint256 profit = IERC20(debtAsset).balanceOf(address(this)) - owed;
        if (profit > 0) IERC20(debtAsset).transfer(owner, profit);
        return true;
    }
}
```

## 测试要点

1. **fork 主网到清算前 1 个区块**：用 cast 找一个被清算地址，fork 到清算 tx 前。
2. **模拟 Chainlink stale 场景**：把 `priceFeed` 替换成 mock 让 updatedAt 老于 1 小时——liquidate 应该 revert "STALE_PRICE"。
3. **gas + 净利**：记录清算后 owner 拿到多少 USDC，扣 gas 算净 ROI。

## 进阶练习

- 加 sandwich 防御：在 swap 前用 Pyth pull 价格做 sanity check。
- 加多池路由：抵押品先 swap 成 WETH 再 swap 成 debt asset，找最优路径。
- 加 MEV bundle：把 liquidate tx 通过 Flashbots Protect 发，避免被前端抢跑。
