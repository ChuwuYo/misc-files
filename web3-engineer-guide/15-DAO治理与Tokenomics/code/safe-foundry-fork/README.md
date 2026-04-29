# Safe（Gnosis Safe）Foundry Fork 模拟

## 教学目标

- 学会用 Foundry fork 真实链状态来 inspect 任意 Safe
- 理解 Safe 的 owners + threshold 不变量
- 为下一步"模拟提案 + 模拟签名" 打底

## 运行

```bash
export MAINNET_RPC_URL=https://eth.llamarpc.com
forge test --match-path "*SafeFork*" -vvv
```

## 预期输出

```
Safe address: 0x2501c477...
Threshold:    5
Owner count:  9
  owner 0 0x...
  ...
```

## 进阶练习

替换 `SAFE` 常量到下面的真实 Safe 地址观察：

| Safe | 地址 |
|------|------|
| Optimism Foundation | `0x2501c477D0A35545a387Aa4A3EEe4292A9a8B3F0` |
| Lido DAO Treasury | `0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c` |
| Uniswap Treasury | 需查 [Uniswap docs](https://docs.uniswap.org/) |

## 真实模拟交易（高级）

完整 propose-sign-execute 模拟需要：
1. 收集 N 个 owner 私钥（测试用 vm.sign 伪造）
2. 计算 Safe transaction hash（EIP-712）
3. 拼接签名按 owner 地址升序
4. 调用 execTransaction

参考 [Safe SDK 文档](https://docs.safe.global/sdk/overview) 完整实现。
