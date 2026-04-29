# 05 - Foundry 跑 EVM 字节码

## 准备

```bash
# 安装 Foundry stable v1.0+
curl -L https://foundry.paradigm.xyz | bash
foundryup        # 不带 -i nightly 默认装 stable v1.0+
forge --version  # 应输出 1.x.y

# 在本目录初始化 forge-std
forge install foundry-rs/forge-std --no-commit
```

## 跑测试看 stack/memory/storage diff

```bash
# -vvvv 打开 trace，看每个 opcode 的 stack/memory 变化
forge test -vvvv --match-contract StackPlayTest

# 看具体 SSTORE 的 cold/warm gas
forge test -vvvv --match-test test_GasDiff

# 看 state diff
forge test -vvvv --match-test test_StateDiff
```

## 看汇编反编译

```bash
forge build
forge inspect StackPlay bytecode
forge inspect StackPlay deployedBytecode
forge inspect StackPlay methodIdentifiers
```

或者直接：

```bash
forge inspect StackPlay irOptimized   # 看优化后的 Yul IR
```

## 用 Anvil 跑本地链 + cast 调用

```bash
anvil --hardfork prague     # 启动本地 Pectra 链，10 个测试账户

# 另开一个终端
forge create src/StackPlay.sol:StackPlay --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 设 ADDR 为 forge create 输出的地址
cast send $ADDR "bump()" --rpc-url http://127.0.0.1:8545 --private-key 0xac0974...
cast call $ADDR "counter()(uint256)" --rpc-url http://127.0.0.1:8545
```
