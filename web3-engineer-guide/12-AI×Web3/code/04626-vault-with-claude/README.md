# Demo 1：Claude Code 搭建 ERC-4626 Vault

> 配合主 README §6 阅读。这里只放可复现的最小步骤。
>
> 文档版本：v1.0 · 最后更新 2026-04-27

## 前置依赖

```bash
# 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Claude Code（已登录账号）
claude --version
```

## 步骤 1：初始化项目

```bash
forge init vault-demo
cd vault-demo
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
```

`foundry.toml` 加上：

```toml
[profile.default]
solc_version = "0.8.26"
optimizer = true
optimizer_runs = 200
remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/"
]
```

## 步骤 2：在仓库根目录建 `CLAUDE.md`

```markdown
# Vault Demo - Claude Code 项目约束

## 工程标准
- solc 0.8.26
- Foundry，OZ contracts v5
- 所有 ERC20 调用必须用 SafeERC20
- 所有 external 函数必须 NatSpec
- 测试覆盖率目标 95%+

## 安全清单
- 必须处理 share inflation 攻击（首存攻击）
- convertToShares / convertToAssets 的 rounding 方向必须符合 EIP-4626
- 所有外部调用必须 reentrancy guarded
- 不允许使用 unchecked，除非有明确 gas 优化注释

## 测试要求
1. deposit / mint / withdraw / redeem happy path
2. deposit when totalAssets() == 0
3. fee accounting after simulated yield
4. share inflation attack scenario
5. zero-address / zero-amount reverts
```

## 步骤 3：跑主 README §6.2 的 prompt 模板

把 prompt 直接交给 Claude Code（终端里跑 `claude`，粘贴 prompt）。

期望产物：

- `src/Vault.sol`（约 150-250 行）
- `test/Vault.t.sol`（约 200-400 行）

## 步骤 4：人工审查清单（必读）

按主 README §6.3 的 5 件事核对。任意一项不符必须重写：

- [ ] rounding 方向符合 EIP-4626
- [ ] 处理 share inflation
- [ ] fee 结算位置不会被 sandwich
- [ ] 外部调用前后无 reentrancy 漏洞
- [ ] 编译告警全部清零

## 步骤 5：跑测试

```bash
forge test -vvv
forge coverage
```

## 实测时间记录模板

| 阶段                       | 不用 AI 估时 | 用 Claude Code 实测 |
| -------------------------- | ------------ | ------------------- |
| 写 Vault.sol               |              |                     |
| 写测试                     |              |                     |
| 修复 Claude 的错误         | n/a          |                     |
| 人工审查 + 改 rounding     |              |                     |
| **总计**                   |              |                     |

填完发到团队周报里，是难得的"真实生产力数据"。

## 进阶：把这套流程编码成 Claude Code Skill

参考 [trailofbits/skills](https://github.com/trailofbits/skills) 仓库的格式，把上面的 CLAUDE.md + prompt 模板 + 审查清单合并成一个 `vault-erc4626.skill.md`，下次复用时一行 `claude --skill vault-erc4626` 就可以。
