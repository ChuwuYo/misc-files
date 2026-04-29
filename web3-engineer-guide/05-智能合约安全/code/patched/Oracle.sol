// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Chainlink 风格的预言机接口（带 stale 检查）。
interface IChainlinkAggregator {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function decimals() external view returns (uint8);
}

/// @title 防御版：Chainlink + 心跳检查 + 健康度
contract SafeLendingPool {
    IERC20 public immutable collateral;
    IERC20 public immutable debt;
    IChainlinkAggregator public immutable feed;
    uint256 public immutable heartbeat; // 例如 3600 秒
    uint256 public constant LTV_BPS = 7500;

    mapping(address => uint256) public collateralBal;
    mapping(address => uint256) public debtBal;

    error StalePrice();
    error BadPrice();

    constructor(IERC20 _c, IERC20 _d, IChainlinkAggregator _f, uint256 _hb) {
        collateral = _c;
        debt = _d;
        feed = _f;
        heartbeat = _hb;
    }

    /// @dev 多重检查：最近时间戳、非零、roundId 一致。
    function safePrice() public view returns (uint256) {
        (uint80 rid, int256 ans, , uint256 updatedAt, uint80 answeredIn) = feed.latestRoundData();
        if (ans <= 0) revert BadPrice();
        if (answeredIn < rid) revert StalePrice();
        if (block.timestamp - updatedAt > heartbeat) revert StalePrice();
        // 归一到 1e18
        uint256 price = uint256(ans);
        uint8 dec = feed.decimals();
        if (dec < 18) price = price * (10 ** (18 - dec));
        else if (dec > 18) price = price / (10 ** (dec - 18));
        return price;
    }

    function depositCollateral(uint256 amt) external {
        collateral.transferFrom(msg.sender, address(this), amt);
        collateralBal[msg.sender] += amt;
    }

    function borrow(uint256 amt) external {
        uint256 collValue = (collateralBal[msg.sender] * safePrice()) / 1e18;
        uint256 maxBorrow = (collValue * LTV_BPS) / 10_000;
        require(debtBal[msg.sender] + amt <= maxBorrow, "LTV");
        debtBal[msg.sender] += amt;
        debt.transfer(msg.sender, amt);
    }
}
