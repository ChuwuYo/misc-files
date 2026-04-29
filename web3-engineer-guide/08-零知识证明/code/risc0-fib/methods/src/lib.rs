// risc0-build 在编译期生成 FIB_GUEST_ELF / FIB_GUEST_ID 常量
include!(concat!(env!("OUT_DIR"), "/methods.rs"));
