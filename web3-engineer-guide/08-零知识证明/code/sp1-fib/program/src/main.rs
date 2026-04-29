// SP1 guest program：算第 n 个斐波那契数，并 commit (n, fib(n))
// 编译目标：RISC-V RV32IM
// 用 `cargo prove build --bin fibonacci-program -p program` 编译

#![no_main]
sp1_zkvm::entrypoint!(main);

pub fn main() {
    let n = sp1_zkvm::io::read::<u32>();

    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 0..n {
        let c = a.wrapping_add(b);
        a = b;
        b = c;
    }

    sp1_zkvm::io::commit(&n);
    sp1_zkvm::io::commit(&a);
}
