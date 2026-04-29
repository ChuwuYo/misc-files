// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice 极简的 Uniswap V2 风格池子（用于演示，不要在生产里抄）。
interface IPair {
    function getReserves() external view returns (uint112 r0, uint112 r1, uint32 ts);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/// @title 现货价 oracle 漏洞：直接读取 spot 储备
/// @notice 还原 Mango Markets（2022-10-11，损失约 1.16 亿美元）与 Cream Finance
/// （2021-10-27，损失约 1.3 亿美元）的核心错误：抵押品估值依赖单池现货价，
/// 攻击者用闪电贷把现货价拉飞即可借走全部金库。
contract NaiveLendingPool {
    IERC20 public immutable collateral;
    IERC20 public immutable debt;
    IPair public immutable pricePair;
    uint256 public constant LTV_BPS = 7500; // 75%

    mapping(address => uint256) public collateralBal;
    mapping(address => uint256) public debtBal;

    constructor(IERC20 _collateral, IERC20 _debt, IPair _pricePair) {
        collateral = _collateral;
        debt = _debt;
        pricePair = _pricePair;
    }

    function depositCollateral(uint256 amt) external {
        collateral.transferFrom(msg.sender, address(this), amt);
        collateralBal[msg.sender] += amt;
    }

    /// @dev 漏洞：spotPrice 直接读储备，单笔交易内可被操纵。
    function spotPrice() public view returns (uint256) {
        (uint112 r0, uint112 r1, ) = pricePair.getReserves();
        address t0 = pricePair.token0();
        if (t0 == address(collateral)) {
            return (uint256(r1) * 1e18) / uint256(r0);
        } else {
            return (uint256(r0) * 1e18) / uint256(r1);
        }
    }

    function borrow(uint256 amt) external {
        uint256 collValueInDebt = (collateralBal[msg.sender] * spotPrice()) / 1e18;
        uint256 maxBorrow = (collValueInDebt * LTV_BPS) / 10_000;
        require(debtBal[msg.sender] + amt <= maxBorrow, "LTV");
        debtBal[msg.sender] += amt;
        debt.transfer(msg.sender, amt);
    }
}
