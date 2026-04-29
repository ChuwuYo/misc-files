# Solana / Anchor Counter Demo

一个最小可跑的 Anchor 程序：在链上维护一个 `counter` PDA，提供 `initialize` 与 `increment` 两个指令；
配套 TypeScript 客户端调用 + Mocha 测试。

## 环境（2026-04 实测）

- **Solana CLI 3.1.10**（Anza 维护，安装地址已迁到 `release.anza.xyz`）
- **Anchor CLI 0.31.1**（仓库已从 `coral-xyz/anchor` 迁到 `solana-foundation/anchor`；Anchor 1.0 已发布但生态尚未全量迁移，本教程用 0.31.1 兼容主流）
- Node 20.x、pnpm 9.x
- Rust 1.85+

```bash
# 一键脚本（官方推荐）
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash

# 或分步：
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install --git https://github.com/solana-foundation/anchor avm --force
avm install latest && avm use latest
```

> 注：Anchor 0.30.1 是 2024-2025 主线，1.0 在 2026-04 初发布。本仓库 `Cargo.toml` 中
> `anchor-lang` 写 `0.31.1`（兼容性更广）；如需 1.0 特性，把 0.31.1 全局替换成 1.0.1 即可。

## 跑通步骤

```bash
# 1. 拉起本地 validator（另一个终端）
solana-test-validator --reset

# 2. 配置 CLI 指向 localnet
solana config set --url localhost
solana-keygen new -o ~/.config/solana/id.json   # 若无 keypair
solana airdrop 5

# 3. 构建并部署
anchor build
anchor deploy            # 拿到 program_id
# 把输出的 program_id 写到 lib.rs 的 declare_id! 与 Anchor.toml [programs.localnet]
anchor build && anchor deploy

# 4. 运行测试（会走客户端调用流程）
anchor test --skip-local-validator
```

## 文件结构

```
solana/
├── Anchor.toml
├── Cargo.toml                  # workspace
├── programs/counter/
│   ├── Cargo.toml
│   └── src/lib.rs              # 程序本体
├── tests/counter.ts            # mocha 测试 + 客户端调用
├── package.json
└── tsconfig.json
```

## Native（无 Anchor）等价骨架

文件 `native/lib.rs` 演示同样语义的纯 `solana_program` 实现，对照 Anchor 看出宏的代价与省力点。
