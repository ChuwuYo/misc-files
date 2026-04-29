// 在 host crate 编译时把 program crate 也编译成 RISC-V ELF。
fn main() {
    sp1_build::build_program("../program");
}
