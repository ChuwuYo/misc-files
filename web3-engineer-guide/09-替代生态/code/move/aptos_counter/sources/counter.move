/// Aptos Move 风格 counter：用 #[resource_group] + global storage。
/// 对照 Sui 版本理解差异：
///   - 无 UID / object，状态用 move_to<Counter>(signer, ...) 挂在某个 address 下
///   - 共享写入要么靠 published address 上的资源（任意人读，作者写），
///     要么用 fungible_asset 之类的标准
module default::counter {
    use std::signer;

    #[resource_group(scope = global)]
    struct CounterGroup {}

    #[resource_group_member(group = default::counter::CounterGroup)]
    struct Counter has key {
        value: u64,
    }

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY: u64 = 2;

    public entry fun initialize(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<Counter>(addr), E_ALREADY);
        move_to(account, Counter { value: 0 });
    }

    public entry fun increment(account: &signer) acquires Counter {
        let addr = signer::address_of(account);
        assert!(exists<Counter>(addr), E_NOT_INITIALIZED);
        let c = borrow_global_mut<Counter>(addr);
        c.value = c.value + 1;
    }

    #[view]
    public fun get(addr: address): u64 acquires Counter {
        borrow_global<Counter>(addr).value
    }

    // ---- Move Prover spec 例子 ----
    // 形式化：increment 后 value 必然等于旧值 + 1，且不会回绕（隐含 abort）。
    spec increment {
        let addr = signer::address_of(account);
        aborts_if !exists<Counter>(addr);
        aborts_if global<Counter>(addr).value + 1 > MAX_U64;
        ensures global<Counter>(addr).value == old(global<Counter>(addr).value) + 1;
    }
}
