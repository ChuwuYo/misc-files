// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice 教学版 Aave V3 + Chainlink + Uniswap V3 清算合约骨架。
/// @dev 这是一个最小框架，省略了真实的 Aave / Uniswap 依赖以避免 fork test 强依赖。
///      如需运行 fork 测试，请：
///        1. forge install aave/aave-v3-core
///        2. forge install uniswap/v3-periphery
///        3. forge install smartcontractkit/chainlink-brownie-contracts
///        4. 把下面的本地 interface 替换为官方包导入
///      参考 README.md 中的"完整版"代码。
interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external;

    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}

interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

contract Liquidator {
    IPool public immutable POOL;
    ISwapRouter public immutable swapRouter;
    address public immutable owner;

    error NotOwner();
    error NotPool();
    error StalePrice();
    error Healthy();
    error WrongAsset();

    /// @notice 价格 staleness 阈值（1 小时）。生产环境按资产灵敏度调整。
    uint256 public constant PRICE_STALE_THRESHOLD = 3600;

    constructor(address pool, address router) {
        POOL = IPool(pool);
        swapRouter = ISwapRouter(router);
        owner = msg.sender;
    }

    /// @notice 入口：检查 oracle + HF，借闪电贷清算。
    function liquidate(
        address borrower,
        address collateralAsset,
        address debtAsset,
        uint256 debtToCover,
        IAggregatorV3 priceFeed,
        uint24 swapFeeTier
    ) external {
        if (msg.sender != owner) revert NotOwner();

        // 1. Oracle staleness check
        (, int256 ans,, uint256 updated,) = priceFeed.latestRoundData();
        if (ans <= 0 || block.timestamp - updated > PRICE_STALE_THRESHOLD) revert StalePrice();

        // 2. HF<1 才允许清算
        (,,,,, uint256 hf) = POOL.getUserAccountData(borrower);
        if (hf >= 1e18) revert Healthy();

        // 3. 借闪电贷
        bytes memory params = abi.encode(borrower, collateralAsset, debtAsset, swapFeeTier);
        POOL.flashLoanSimple(address(this), debtAsset, debtToCover, params, 0);
    }

    /// @notice Aave 闪电贷回调。
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address, /* initiator */
        bytes calldata params
    ) external returns (bool) {
        if (msg.sender != address(POOL)) revert NotPool();

        (address borrower, address collateralAsset, address debtAsset, uint24 fee) =
            abi.decode(params, (address, address, address, uint24));
        if (asset != debtAsset) revert WrongAsset();

        // 1. 还债
        IERC20(debtAsset).approve(address(POOL), amount);
        POOL.liquidationCall(collateralAsset, debtAsset, borrower, amount, false);

        // 2. 把抵押品换回 debt asset 还闪电贷
        uint256 collBal = IERC20(collateralAsset).balanceOf(address(this));
        IERC20(collateralAsset).approve(address(swapRouter), collBal);
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: collateralAsset,
                tokenOut: debtAsset,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: collBal,
                amountOutMinimum: 0, // 教学简化；生产应基于 Chainlink 算 minOut
                sqrtPriceLimitX96: 0
            })
        );

        // 3. 还闪电贷 + 利润给 owner
        uint256 owed = amount + premium;
        IERC20(debtAsset).approve(address(POOL), owed);

        uint256 balance = IERC20(debtAsset).balanceOf(address(this));
        if (balance > owed) {
            IERC20(debtAsset).transfer(owner, balance - owed);
        }
        return true;
    }
}
