# 练习 1：Merkle Proof + Poseidon

## 任务

写一个 Circom 电路，证明「我知道一个叶子 leaf 和一条长度 20 的 Merkle path（兄弟节点 + 0/1 方向位），使得叶子哈希到 root」。

`merkle_proof.circom` 已给出脚手架，三处 `TODO` 需要你补全：

1. **TODO 1**：约束方向位 `pathIndices[i]` 是 0 或 1（`x*(1-x) === 0`）；
2. **TODO 2**：根据方向位选择 left/right（用线性组合，注意 circom 单次只允许一次乘法）；
3. **TODO 3**：把 left/right 接到 Poseidon(2) 哈希器的输入。

## 跑

```bash
# 1. 进 code/circom-poseidon/ 装好 circomlib
cd ../../code/circom-poseidon && npm install && cd -

# 2. 编译
circom merkle_proof.circom --r1cs --wasm --sym

# 3. 准备 input.json（自己造一棵 5 层小树，写脚本生成 path）
# ... 略，参考 Tornado Cash / Semaphore 的 build_witness 工具

# 4. 跑流程同 code/circom-poseidon/run.sh
```

## 思考

- 为什么必须显式约束 `pathIndices[i]` 在 {0, 1} 内？如果不约束，恶意 prover 能怎么作弊？
- 这个电路恰好是 Tornado Cash、Semaphore、几乎所有 zk-airdrop 的基础原语。它的 leaf 和 root 公开/私有的设计为什么这样安排？
