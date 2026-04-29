# Move: Sui shared object counter + Aptos resource counter

两个包，对照看 **Sui Move（对象模型）** 与 **Aptos Move（全局存储 / resource）** 的根本差异。

## 环境（2026-04 推荐）

- Sui CLI 1.40+（`sui --version`），Move 2024 edition
- Aptos CLI 4.x（`aptos --version`）
- Node 20.x，pnpm 9，`@mysten/sui` 1.x（注意：旧包 `@mysten/sui.js` 已弃用）

```bash
# Sui
brew install sui      # 或 cargo install --locked --git https://github.com/MystenLabs/sui.git sui
# Aptos
brew install aptos
```

## Sui 部分

```
move/
├── Move.toml              # Sui 包清单
├── sources/counter.move   # shared object counter
└── client/                # TypeScript 客户端
    ├── package.json
    └── call.ts
```

### 跑通

```bash
# 启动 localnet（另一个终端）
sui start --with-faucet --force-regenesis

# 配置 client
sui client new-env --alias localnet --rpc http://127.0.0.1:9000
sui client switch --env localnet
sui client faucet

# 编译并发布
sui move build
sui client publish --gas-budget 100000000

# 用客户端调用（替换 PACKAGE_ID）
cd client
pnpm install
PACKAGE_ID=0x... pnpm tsx call.ts
```

## Aptos 部分

```
aptos_counter/
├── Move.toml
└── sources/counter.move    # 用 #[resource_group] 演示 Aptos 风格
```

```bash
cd aptos_counter
aptos init --network local       # 启动本地 testnet
aptos move publish
aptos move run --function-id 'default::counter::initialize'
aptos move run --function-id 'default::counter::increment'
aptos move view --function-id 'default::counter::get' \
  --args address:default
```

## 核心心智差异（一句话版）

| 维度 | Sui Move | Aptos Move | Solidity 对照 |
|------|----------|------------|---------------|
| 状态归属 | 每个 Object 有 owner | 每个 resource 挂在某 address 的全局存储下 | 状态全归合约 |
| 共享写 | shared object（共识层排序） | 任意 signer 调用 + global storage | mapping(address=>X) |
| 并行 | 对象隔离 → Sui 默认并行 | Block-STM 乐观并行 | 串行 |
| 转移 | `transfer::transfer` move 对象 | `move_to`/`move_from` 改 owner address | `transfer()`（仅余额） |
| 形式验证 | Move Prover（实验性） | Move Prover（已用于 framework） | 较弱（SMT/SMTChecker） |
