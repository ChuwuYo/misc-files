# Circom 2.2 + snarkjs 0.7 Poseidon 原像证明

本目录跑通「我知道 x 使 Poseidon(x) = y」的完整流水线。

## 先决条件

```bash
# circom 2.2.2
git clone https://github.com/iden3/circom.git
cd circom && git checkout v2.2.2 && cargo install --path circom

# Node 22+ 自带 npm/npx
node --version    # >= 22.0
```

## 一键跑通

```bash
npm install
bash run.sh
```

脚本会引导你：

1. 编译 circom 电路；
2. 用 `circomlibjs` 算出 Poseidon(3, 5) 的真实哈希；
3. 把哈希填回 `input.json` 后回车继续；
4. 跑 Powers of Tau Phase 1 + Phase 2 ceremony（教学用）；
5. 生成 witness、proof、public signals；
6. 链下 verify；
7. 导出 Solidity verifier + calldata。

## 上链验

```bash
anvil &  # 本地以太坊节点
forge create verifier.sol:Groth16Verifier \
    --rpc-url http://localhost:8545 \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 用 calldata.txt 里的内容调 verifyProof：
cast call <DEPLOYED_ADDR> "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[1])" \
    "$(cat calldata.txt)"
```

## 文件清单

| 文件 | 作用 |
|------|------|
| `poseidon_preimage.circom` | Circom 电路源 |
| `compute_hash.js` | 用 circomlibjs 算 Poseidon(3, 5) |
| `input.json` | witness 输入（要先跑 compute_hash.js 填 expectedHash） |
| `run.sh` | 一键跑通脚本 |
| `package.json` | npm 依赖 |

## 注意

- 教学用 Phase 1 ceremony 不安全，**生产请用 [Hermez ptau](https://github.com/iden3/snarkjs#7-prepare-phase-2)**；
- snarkjs 0.7.6 已默认修复早期 verifier 的 malleability；
- 跑完后，run.sh 在当前目录留下大量中间产物（pot12_*.ptau、circuit_*.zkey、proof.json 等），可放心删除重跑。
