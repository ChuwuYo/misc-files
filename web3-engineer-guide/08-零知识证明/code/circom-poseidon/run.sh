#!/usr/bin/env bash
# Circom 2.2 + snarkjs 0.7 端到端跑通：Poseidon 原像证明
# 前置：Node 22+、Rust 1.80+、circom 2.2.2、Foundry（可选，链上验）
#
# 用法：bash run.sh
set -euo pipefail

echo "==> 0. 安装依赖（首次）"
[ -d node_modules ] || npm install

echo "==> 1. 编译电路"
circom poseidon_preimage.circom --r1cs --wasm --sym

echo "==> 2. 生成 expectedHash"
node compute_hash.js

echo "  请把上面输出填到 input.json 的 expectedHash 字段，然后再次运行此脚本（按回车继续）"
read -r

echo "==> 3. Phase 1：Powers of Tau（教学用，生产请用 hez ptau）"
npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau \
    --name="dev contribution" -v -e="some random text"
npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

echo "==> 4. Phase 2：电路相关 setup"
npx snarkjs groth16 setup poseidon_preimage.r1cs pot12_final.ptau circuit_0000.zkey
npx snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey \
    --name="dev contribution" -v -e="another random text"
npx snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

echo "==> 5. 生成 witness"
node poseidon_preimage_js/generate_witness.js \
    poseidon_preimage_js/poseidon_preimage.wasm input.json witness.wtns

echo "==> 6. 生成 proof"
npx snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json

echo "==> 7. 链下校验 proof"
npx snarkjs groth16 verify verification_key.json public.json proof.json

echo "==> 8. 导出 Solidity verifier"
npx snarkjs zkey export solidityverifier circuit_final.zkey verifier.sol

echo "==> 9. 导出 verifier calldata（用于链上验证）"
npx snarkjs zkey export soliditycalldata public.json proof.json > calldata.txt

echo
echo "============================="
echo "完成。"
echo "下一步：把 verifier.sol 部署到本地 Anvil 或公网 testnet，然后用 calldata.txt 调 verifyProof()。"
echo "  anvil &"
echo "  forge create verifier.sol:Groth16Verifier --rpc-url http://localhost:8545 \\"
echo "      --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo "============================="
