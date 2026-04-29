pragma circom 2.1.6;

include "../../code/circom-poseidon/node_modules/circomlib/circuits/poseidon.circom";

// 练习 1：Merkle Proof + Poseidon
// ---------------------------------
// 证明「我知道一个 leaf + 一条长度 N 的 Merkle path（兄弟 + 方向位），使叶子哈希到 root」
// 公开：root
// 私有：leaf、pathElements[N]、pathIndices[N]
//
// 你需要补全 TODO 区域。

template MerkleProof(N) {
    signal input leaf;
    signal input pathElements[N];
    signal input pathIndices[N];   // 每位是 0 或 1
    signal input root;

    component hashers[N];
    signal levelHash[N + 1];
    levelHash[0] <== leaf;

    for (var i = 0; i < N; i++) {
        // TODO 1：约束 pathIndices[i] 是 0 或 1
        // 提示：写 pathIndices[i] * (1 - pathIndices[i]) === 0;

        // TODO 2：根据 pathIndices[i] 选择 left/right
        // 当 pathIndices[i] == 0：left = levelHash[i], right = pathElements[i]
        // 当 pathIndices[i] == 1：left = pathElements[i], right = levelHash[i]
        //
        // 提示：用线性组合
        //   left  = (1 - pathIndices[i]) * levelHash[i] + pathIndices[i] * pathElements[i]
        //   right = (1 - pathIndices[i]) * pathElements[i] + pathIndices[i] * levelHash[i]
        // 但 circom 不允许两次乘法在一个 signal 赋值里，需要中间 signal。

        hashers[i] = Poseidon(2);
        // TODO 3：把 left/right 接到 hashers[i].inputs[0/1]
        // hashers[i].inputs[0] <== left;
        // hashers[i].inputs[1] <== right;

        levelHash[i + 1] <== hashers[i].out;
    }

    // 最后一层 hash 必须等于 root
    root === levelHash[N];
}

component main { public [root] } = MerkleProof(20);
