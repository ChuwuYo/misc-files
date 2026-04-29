# SimpleERC3643 — 许可型代币教学版

## 教学目标

- 理解 ERC-3643（T-REX）"许可型转账"的核心 hook
- 知道 `_update` 是 OZ 5.x 的统一 transfer hook
- 知道 forced transfer 是 RWA 监管现实需求

## 真实 ERC-3643 vs 简化版

| 功能 | 真实 ERC-3643 | 本简化版 |
|------|-------------|---------|
| KYC 注册 | IdentityRegistry + ONCHAINID | mapping(address => bool) |
| 业务规则 | Compliance Module（多个 sub-module） | 单 `verified` flag |
| 强制转账 | ✅ | ✅ |
| Pause | ✅ | ✅ |
| Recovery | ✅（账户丢失恢复） | ❌ |
| 多 agent | ✅ | 单 agent |

## 真生产推荐

直接 fork [Tokeny T-REX](https://github.com/TokenySolutions/T-REX)（已审计、被 BUIDL 等使用）。

## 测试

```bash
forge test --match-path "*SimpleERC3643*" -vvv
```
