// Risc0 guest：算第 n 个斐波那契数，commit (n, fib_n) 到 journal
use risc0_zkvm::guest::env;

fn main() {
    let n: u32 = env::read();

    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 0..n {
        let c = a.wrapping_add(b);
        a = b;
        b = c;
    }

    env::commit(&(n, a));
}
