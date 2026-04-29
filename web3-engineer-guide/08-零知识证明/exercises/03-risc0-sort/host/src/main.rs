use methods::{SORT_GUEST_ELF, SORT_GUEST_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use risc0_zkvm::sha::{Impl, Sha256};

fn main() {
    // 输入一组随机 u32
    let input: Vec<u32> = vec![5, 2, 9, 1, 7, 3, 8, 4, 6];

    let env = ExecutorEnv::builder()
        .write(&input)
        .unwrap()
        .build()
        .unwrap();

    println!("==> proving sort of {:?}", input);
    let receipt = default_prover()
        .prove(env, SORT_GUEST_ELF)
        .unwrap()
        .receipt;

    println!("==> verifying...");
    receipt.verify(SORT_GUEST_ID).expect("verification failed");

    // host 端解 commit：input_hash + sorted
    let (input_hash, sorted): ([u8; 32], Vec<u32>) = receipt.journal.decode().unwrap();

    // 重新计算 input_hash 比对
    let mut bytes = Vec::with_capacity(input.len() * 4);
    for x in &input {
        bytes.extend_from_slice(&x.to_le_bytes());
    }
    let expected = *Impl::hash_bytes(&bytes);

    assert_eq!(expected.as_bytes(), &input_hash, "input hash mismatch");
    println!("OK: sorted = {:?}", sorted);
}
