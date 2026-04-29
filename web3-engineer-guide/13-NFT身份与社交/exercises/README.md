# 模块 13 习题

正文（含答案）位于 [../README.md 第 29 章](../README.md#第-29-章-习题含答案)。

本目录留给读者放自己的解答。建议用法：

1. 先**不看答案**，根据 README 第 29 章的 10 道题独立思考
2. 把你的回答放在本目录下：
   ```
   exercises/
     ├── q1-standard-selection.md
     ├── q2-royalty-enforcement.md
     ├── ...
     ├── q10-compliance.md
     └── extra/        # 你自己设计的延伸题
   ```
3. 对照 README 答案做差距分析
4. 把"我没想到的部分"写成笔记 `notes.md`

## 进阶 lab（可选，超出 10 道基础题）

### Lab A：在 Sepolia 部署完整 NFT 套件
- 用 `code/nft-suite/` 的 `MyNFT.sol` + Deploy script
- 部署 + verify 到 Sepolia
- 写一个 GitHub Action 自动 mint 一张 NFT 给团队成员
- 在 OpenSea testnet 上能看到 + 验证 supportsInterface 返回正确

### Lab B：搭一个完整的 SIWE + EAS 演示站
- 用 `code/eas-attestation/auth.ts` 搭 Next.js 路由
- 用户连接钱包后能看到自己有哪些 attestation
- 集成 EAS Scan API 查询 attestation 历史
- 给 attestation 加一个简单的 web2-style 反向声誉评分

### Lab C：Farcaster Mini App 上线
- 用 `code/farcaster-miniapp/` 部署到 Vercel
- 用自己的 fid 签发 accountAssociation
- 在 Warpcast 内 cast 测试链接，验证 unfurl 正常
- 加一个 `sdk.actions.signIn` 的免密登录流程

### Lab D：Mini Marketplace + ERC-2981 强制
- 把 `code/mini-marketplace/` 的 royaltyInfo 检查路径替换成 ERC-721-C 白名单模式
- 写测试覆盖："非白名单交易 reverts" / "白名单交易扣费正确"
- 思考这个改动给生态带来的副作用

### Lab E：跨标准互操作
- 部署一个 ERC-6551 + ERC-1155 demo：
  - 一个 ERC-721 角色 NFT
  - 每个角色 NFT 创建 TBA
  - 用户把 ERC-1155 装备转进 TBA
  - 卖出角色，验证装备跟着到新主
- 编写文档说明："为什么直接用 ERC-721 + 各种 mapping 模拟内置背包不如 6551 干净"
