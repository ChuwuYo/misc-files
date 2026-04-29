# 练习 1：评估你常用的 AI 审计工具

> 主 README §10.1
>
> 目的：让你**亲手**测出"AI 审计 hype vs 真实能力"的差距。

## 任务

1. 从 [rekt.news](https://rekt.news/) 选 3 个**已修复且公开 root cause** 的合约漏洞。建议候选：
   - SushiSwap RouteProcessor2（2023-04）
   - Euler Finance v1（2023-03）
   - Bedrock DeFi（2024-09）
   - Radiant Capital（2024-10）
   - 其他你熟悉的
2. 准备 5 个工具：
   - Claude Code（带 Slither-MCP + Aderyn-MCP）
   - Cursor（无 MCP）
   - Aderyn 单跑
   - Slither 单跑
   - 一个 vibe audit 类工具（任选）
3. 对每个合约用同一份 prompt 跑每个工具，统计：
   - **召回率**：找到的真实漏洞 / 实际有的真实漏洞
   - **误报率**：虚假 finding / 总 finding
   - **平均耗时**

## 报告模板

```markdown
# AI 审计工具对照评估 - <你的名字> - <日期>

## 测试合约

| ID | 项目 | 漏洞类型 | 损失金额 | 公开 PoC URL |
|----|------|----------|----------|--------------|
| C1 |      |          |          |              |
| C2 |      |          |          |              |
| C3 |      |          |          |              |

## Prompt 模板

（贴你给所有工具用的同一份 prompt）

## 数据汇总

| 工具                      | C1 召回 | C1 误报 | C2 召回 | C2 误报 | C3 召回 | C3 误报 | 平均耗时 |
|---------------------------|---------|---------|---------|---------|---------|---------|----------|
| Claude Code + MCPs        |         |         |         |         |         |         |          |
| Cursor                    |         |         |         |         |         |         |          |
| Aderyn                    |         |         |         |         |         |         |          |
| Slither                   |         |         |         |         |         |         |          |
| Vibe Audit X              |         |         |         |         |         |         |          |

## 你的发现

- 召回最高的工具：
- 误报最高的工具：
- 三个合约里**所有工具都漏掉**的漏洞：
- 三个合约里**所有工具都误报**的位置：

## 工程师结论

（200-500 字）你的工作流应该用哪几个工具组合？为什么？
```

## 预期发现（不要先看）

<details>
<summary>展开</summary>

- 单 LLM 召回率多在 30-50%；
- 加 Slither/Aderyn MCP 后能拉到 60-70%，但**误报率激增**；
- vibe audit 类工具会输出 80%+ 的 noise（"建议加 access control"等）；
- 跨合约/跨协议的逻辑漏洞，所有工具都漏。

跟主 README §2.1.8 中的实测数据对比，看你测出来的数字落在什么位置。

</details>
