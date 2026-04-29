pragma circom 2.2.2;

include "node_modules/circomlib/circuits/poseidon.circom";

// 证明「我知道 N 个 field 元素 preimage[]，使 Poseidon(preimage) = expectedHash」
// expectedHash 公开，preimage 私有
template PoseidonPreimage(N) {
    signal input preimage[N];
    signal input expectedHash;
    signal output ok;

    component h = Poseidon(N);
    for (var i = 0; i < N; i++) {
        h.inputs[i] <== preimage[i];
    }

    expectedHash === h.out;
    ok <== 1;
}

component main { public [expectedHash] } = PoseidonPreimage(2);
