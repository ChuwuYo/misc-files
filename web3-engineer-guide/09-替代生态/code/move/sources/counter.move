/// 一个 shared object 计数器。
/// - `Counter` 是 shared object，任何人都可以 increment
/// - 只有 owner 能 reset，演示 capability + 权限
module counter::counter;

use sui::event;

public struct Counter has key {
    id: UID,
    owner: address,
    value: u64,
}

public struct AdminCap has key, store {
    id: UID,
}

public struct Incremented has copy, drop {
    counter_id: ID,
    new_value: u64,
}

/// 创建并 share 一个 Counter，把 AdminCap 转给调用者。
/// `entry` 函数 = 可以从交易顶层调用。
public entry fun create(ctx: &mut TxContext) {
    let sender = tx_context::sender(ctx);
    let counter = Counter {
        id: object::new(ctx),
        owner: sender,
        value: 0,
    };
    let cap = AdminCap { id: object::new(ctx) };
    transfer::transfer(cap, sender);
    transfer::share_object(counter);
}

/// 任何人都能调用 —— shared object 由共识层排序写。
public entry fun increment(c: &mut Counter) {
    c.value = c.value + 1;
    event::emit(Incremented { counter_id: object::id(c), new_value: c.value });
}

/// 只有 cap 持有者能 reset。
public entry fun reset(_cap: &AdminCap, c: &mut Counter) {
    c.value = 0;
}

public fun value(c: &Counter): u64 { c.value }
public fun owner(c: &Counter): address { c.owner }

#[test_only]
use sui::test_scenario as ts;

#[test]
fun test_increment() {
    let alice = @0xA11CE;
    let mut sc = ts::begin(alice);
    {
        create(ts::ctx(&mut sc));
    };
    ts::next_tx(&mut sc, alice);
    {
        let mut c = ts::take_shared<Counter>(&sc);
        increment(&mut c);
        increment(&mut c);
        assert!(value(&c) == 2, 0);
        ts::return_shared(c);
    };
    ts::end(sc);
}
