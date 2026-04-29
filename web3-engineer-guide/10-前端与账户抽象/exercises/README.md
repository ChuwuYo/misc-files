# 模块 10 习题

每题独立目录，含题目、骨架、参考解答（在 `solution/` 子目录中）。建议先盖住 solution 自己写一遍。

| 题目 | 目录 | 难度 | 知识点 |
| --- | --- | --- | --- |
| 1. EIP-712 签名钓鱼检测 | `01-eip712-phishing-detector/` | 中 | EIP-712 解析、白名单、风险标签 |
| 2. Session Key 一次授权多次交易 | `02-session-key-demo/` | 中高 | ZeroDev Kernel + SessionKeyValidator |
| 3. OAuth 与钱包绑定 | `03-oauth-wallet-binding/` | 中 | NextAuth 多 provider + SIWE 复合签名 |

约束：所有题目都用 `code/` 项目同样的依赖（pnpm 9.15、viem 2.47、wagmi 2.18），可以直接 copy `code/` 当起点。
