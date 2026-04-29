// Noir 1.0 等价电路：证明「我知道 preimage 使 Poseidon(preimage) = expected_hash」
// 公开输入：expected_hash
// 私有输入：preimage

use dep::std::hash::poseidon;

fn main(preimage: [Field; 2], expected_hash: pub Field) {
    let h = poseidon::bn254::hash_2(preimage);
    assert(h == expected_hash);
}

#[test]
fn test_correct_preimage() {
    // 真实 hash 由 nargo 计算并自动填到 Prover.toml；
    // 此测试在 nargo test 时由 Noir 跑：
    let preimage: [Field; 2] = [3, 5];
    let h = poseidon::bn254::hash_2(preimage);
    main(preimage, h);
}
