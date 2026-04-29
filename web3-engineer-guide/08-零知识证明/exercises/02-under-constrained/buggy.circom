pragma circom 2.1.6;

// 练习 2：找 under-constrained 漏洞
// --------------------------------
// 下面是一个看起来「明显正确」的 IsZero 电路：
//   in == 0 时 out = 1
//   in != 0 时 out = 0
//
// 它有一个经典 under-constrained bug。请：
//   1. 找出哪一行让恶意 prover 可以伪造（例如 in != 0 但 out = 1）
//   2. 给出 fix（最小改动）
//   3. 用 circomspect / picus 扫描确认 fix 后无告警
//   4. 在 notes.md 写 30-100 字解释为什么 `<--` 是危险源
//
// 注意：这个 bug 是 ZK 漏洞库里反复出现的「IsZero / Inverse」类模式。

template IsZeroBad() {
    signal input in;
    signal output out;

    signal inv;

    // ⚠ 这一行用 `<--`（仅赋值不约束）
    inv <-- in != 0 ? 1 / in : 0;

    out <== -in * inv + 1;

    // 仅有这一条 quadratic constraint：
    in * out === 0;
}

component main = IsZeroBad();
