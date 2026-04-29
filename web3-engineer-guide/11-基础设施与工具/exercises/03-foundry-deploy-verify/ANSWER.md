# 习题 3 参考答案: Foundry 全自动 deploy + verify

## 关键决策

1. **Etherscan v2 unified API**: 2026-04 起 Etherscan 推出 v2, 一把 key 覆盖 50+ EVM 链, foundry.toml 中 `chain = 8453` 区分链 ID 即可.
2. **Blockscout 备用**: 如果链上没有 Etherscan 覆盖 (新 L2), 用 `--verifier blockscout --verifier-url`.
3. **keystore 加密 vs 私钥裸奔**: `cast wallet import deployer --interactive` 把私钥 AES 加密存到 `~/.foundry/keystores/deployer`, 部署时 `--account deployer` 触发解密. 永远不要 `--private-key 0x...` 出现在 shell history.
4. **--slow 重要**: 等 receipt 才发下一笔 tx, 防止 nonce 错乱.
5. **chainid 守卫**: 在 script 里 `require(block.chainid == ...)` 是最后一道防线, 防止误把 testnet 部到 mainnet.
6. **写出 deployments/<chainid>.json**: 让前端 / 后端通过 chainid 读取地址, 比 hardcode 在前端代码里强 100 倍.
7. **CI 集成**: GitHub Action 用 OIDC 拿 AWS KMS 临时凭证, KMS 签名 (Foundry 1.0+ 支持 `--mnemonic-aws`); 这样 GitHub secret 里没有任何真实密钥.

## 故障排除

- `forge verify-contract` 一直 pending: Etherscan v2 偶尔需 30 分钟传播, `--watch` 会持续 poll.
- "could not detect compiler version": 升级 forge `foundryup`, 或在 verify 加 `--compiler-version v0.8.28+commit.7893614a`.
- "no such file or directory: deployments": 检查 foundry.toml 的 `fs_permissions`.

## 进阶: 跨链同地址部署 (CREATE2)

```solidity
// 使用 CREATE2 + 同 salt, 在所有链上得到相同地址
bytes32 salt = keccak256("MyToken_v1");
token = new MyToken{salt: salt}("Demo", "DMO", 1_000_000 ether);
```

配合 [createX](https://github.com/pcaversaccio/createx) 的 deterministic deployer, 可以一份脚本部到 30+ 链拿到完全一样的地址.
