// SP1 host：调 prover 算斐波那契 + verify
// 跑：cargo run --release -p fibonacci-script
// 链上 wrap：SP1_PROVER=network cargo run --release -p fibonacci-script -- --groth16

use sp1_sdk::{ProverClient, SP1Stdin, include_elf};

const ELF: &[u8] = include_elf!("fibonacci-program");

fn main() {
    sp1_sdk::utils::setup_logger();

    let n: u32 = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    let client = ProverClient::from_env();
    let (pk, vk) = client.setup(ELF);

    let mut stdin = SP1Stdin::new();
    stdin.write(&n);

    println!("==> proving fib({n})...");
    let mut proof = client
        .prove(&pk, &stdin)
        .run()
        .expect("prover failed");

    println!("==> verifying...");
    client.verify(&proof, &vk).expect("verification failed");

    let n_back: u32 = proof.public_values.read();
    let fib_n: u64 = proof.public_values.read();
    println!("OK: n={n_back}, fib(n)={fib_n}");
}
