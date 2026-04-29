// Risc0 host：调 prover 算斐波那契并 verify。
// 跑：cargo run --release

use methods::{FIB_GUEST_ELF, FIB_GUEST_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};

fn main() {
    let n: u32 = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    let env = ExecutorEnv::builder()
        .write(&n)
        .unwrap()
        .build()
        .unwrap();

    println!("==> proving fib({n})...");
    let receipt = default_prover()
        .prove(env, FIB_GUEST_ELF)
        .unwrap()
        .receipt;

    println!("==> verifying...");
    receipt.verify(FIB_GUEST_ID).expect("verification failed");

    let (n_back, fib_n): (u32, u64) = receipt.journal.decode().unwrap();
    println!("OK: n={n_back}, fib(n)={fib_n}");
}
