// 用 circomlibjs 计算 Poseidon(3, 5)，把输出填到 input.json 的 expectedHash
// 用法：node compute_hash.js

import { buildPoseidon } from 'circomlibjs';

const poseidon = await buildPoseidon();
const F = poseidon.F;
const h = poseidon([3n, 5n]);
console.log('Poseidon(3,5) =', F.toString(h));
