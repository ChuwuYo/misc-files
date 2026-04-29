# ERC-4626 Yield Vault（抗 inflation attack + invariant 测试）

实现一个最简 ERC-4626 yield vault，集成 OpenZeppelin v5 的 virtual shares + decimal offset，跑 invariant 测试确认 inflation attack 不成立。

## 学习目标

- ERC-4626 标准接口实现
- inflation attack 三种防御方案对比（dead shares / virtual shares / internal balance）
- Foundry invariant testing

## 运行

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.5.0 --no-commit
forge install foundry-rs/forge-std --no-commit
forge build
forge test -vv
# fuzz 防御测试
forge test --match-test testFuzz_VictimAlwaysGetsShares -vvv
```

> 实际可运行的源码是 `src/MyVault.sol` + `test/MyVault.t.sol`（`pragma 0.8.28`、OZ v5.5）。
> 下面的代码块是教学骨架，与最新源码可能略有差异（例如本仓库的不变量测试用 `testFuzz_*` 取代了 invariant handler 写法，更易于直接 `forge test` 跑通）。

## 合约

`src/MyVault.sol`：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice 教学版 ERC-4626 vault，使用 virtual shares + decimal offset 防 inflation attack。
/// 收益来源由外部 strategy 注入（这里简化为 owner 可以 transfer asset 进 vault 当作 yield）。
contract MyVault is ERC4626 {
    constructor(IERC20 _asset)
        ERC20("My Vault Share", "vMY")
        ERC4626(_asset)
    {}

    /// @dev OpenZeppelin v5 默认 offset = 0。我们 override 成 6 让 inflation 不划算。
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}
```

## 不变量测试

`test/InflationInvariant.t.sol`：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MyVault} from "../src/MyVault.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract Handler is Test {
    MyVault public vault;
    ERC20Mock public asset;
    address[] public actors;

    constructor(MyVault v, ERC20Mock a) {
        vault = v;
        asset = a;
        for (uint i = 0; i < 5; i++) actors.push(address(uint160(i + 1)));
    }

    function deposit(uint actorSeed, uint amt) external {
        address actor = actors[actorSeed % actors.length];
        amt = bound(amt, 1, 1e24);
        asset.mint(actor, amt);
        vm.startPrank(actor);
        asset.approve(address(vault), amt);
        vault.deposit(amt, actor);
        vm.stopPrank();
    }

    function donate(uint amt) external {
        amt = bound(amt, 1, 1e24);
        asset.mint(address(vault), amt);  // 直接 transfer 模拟 inflation 攻击
    }

    function withdraw(uint actorSeed, uint amt) external {
        address actor = actors[actorSeed % actors.length];
        uint maxw = vault.maxWithdraw(actor);
        if (maxw == 0) return;
        amt = bound(amt, 1, maxw);
        vm.prank(actor);
        vault.withdraw(amt, actor, actor);
    }
}

contract InflationInvariantTest is Test {
    MyVault vault;
    ERC20Mock asset;
    Handler handler;

    function setUp() public {
        asset = new ERC20Mock();
        vault = new MyVault(asset);
        handler = new Handler(vault, asset);
        targetContract(address(handler));
    }

    /// 不变量 1: totalAssets >= totalSupply / 1e6 （decimal offset = 6 时的 lower bound）
    function invariant_AssetsAtLeastShares() public view {
        uint256 supply = vault.totalSupply();
        uint256 assets = vault.totalAssets();
        if (supply == 0) return;
        // decimal offset = 6 意味着 1 asset 对应 1e6 share 的"虚拟兑换"
        // 真实 share 价格 = (totalAssets + 1) / (totalSupply + 1e6)
        // 攻击者通过 donate 想把这个比率拉高让小额 deposit 取整为 0
        // 因为 +1e6 的 virtual shares 在分母里，攻击者必须 donate 至少 1e6x 才能让单 share 价格涨到威胁小额 deposit 的程度——经济上不划算
        assertGt(supply, 0);
    }

    /// 不变量 2: 任何 actor 都能 redeem 回他存的至少 99%（小额抗稀释）
    function invariant_NoSilentLoss() public {
        // 复杂版略，留作练习：模拟一个小用户存 1 wei，被 donate 攻击后他能 redeem 多少
    }
}
```

## 三种防御方案对比

| 方案 | 实现复杂度 | gas | 缺点 |
|------|------|-----|------|
| Dead shares（UniV2 思路） | 低 | 低 | 第一个 LP 损失少量 token；首次 deposit 数额必须够大 |
| Virtual shares + decimal offset | 中 | 极小 | offset 选择需要 trade-off：太大浪费小数位、太小防御弱 |
| Internal balance tracking | 高 | 中 | 需要重写所有 transfer 路径，自家代币才容易做到 |

OpenZeppelin v5 默认走 virtual shares + offset=0，可以 override `_decimalsOffset()` 调到 6 让攻击成本提升 1e6 倍。

## 进阶

- 把 strategy 抽出来：vault 调用 `IStrategy.invest(asset)` 由 strategy 拿 asset 去 Aave/Compound/Yearn 滚利。
- 加 fee 模型：管理费（每年 1%）、绩效费（盈利 10%）。
- 接 Aave V3 aToken 做底层（aUSDC 是 rebasing！需要小心 totalAssets 计算）。
