# 练习 01：实现一个 ERC-4626 金库

## 目标

基于 OpenZeppelin v5.5 的 `ERC4626` 扩展实现一个收益金库 `YieldVault`，并完成下列要求：

1. 资产为任意 ERC20（构造时注入），份额为本金库铸造的 ERC20
2. 在 `_update` 钩子中收取 0.5% 提现费（fee on withdraw），费用打到 `feeRecipient`
3. 防止 ERC4626 经典的「inflation attack」：在 `_decimalsOffset()` 返回 6（OZ v5 推荐做法之一）
4. 写测试覆盖：
   - `deposit / withdraw / mint / redeem` 单元测试
   - 模糊测试：随机额度下 `convertToShares ∘ convertToAssets` 单调性
   - 不变量测试：`totalAssets() >= sum(balanceOf(holders))` 在任意调用序列下成立

## 提示

- `function _decimalsOffset() internal view virtual override returns (uint8) { return 6; }`
- 收费可以通过 override `_withdraw` 实现，把 `assets` 拆成「给 receiver 的部分」与「给 feeRecipient 的部分」
- 不变量测试用 `Handler` 模式：把 `targetContract(handler)` 配合 `bound` 限制随机额度

## 参考

- OpenZeppelin ERC4626 源码：`lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol`
- a16z 关于 inflation attack 的分析与 OZ v4.9 的 `_decimalsOffset` 修复

## 评分

- [ ] forge test 全部通过
- [ ] forge coverage 行覆盖 >= 90%
- [ ] inflation attack 测试用例存在并验证防护生效
