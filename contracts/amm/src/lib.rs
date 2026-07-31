#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TokenA,
    TokenB,
    ReserveA,
    ReserveB,
    TotalShares,
    Shares(Address),
}

fn isqrt(n: i128) -> i128 {
    if n <= 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

fn get_admin(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Admin).unwrap()
}

fn get_token_a(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::TokenA).unwrap()
}

fn get_token_b(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::TokenB).unwrap()
}

fn set_reserves(e: &Env, res_a: i128, res_b: i128) {
    e.storage().instance().set(&DataKey::ReserveA, &res_a);
    e.storage().instance().set(&DataKey::ReserveB, &res_b);
}

fn set_total_shares(e: &Env, total: i128) {
    e.storage().instance().set(&DataKey::TotalShares, &total);
}

fn get_user_share_balance(e: &Env, user: &Address) -> i128 {
    e.storage().persistent().get(&DataKey::Shares(user.clone())).unwrap_or(0)
}

fn set_user_share_balance(e: &Env, user: &Address, balance: i128) {
    e.storage().persistent().set(&DataKey::Shares(user.clone()), &balance);
}

#[contract]
pub struct SorobanAMM;

#[contractimpl]
impl SorobanAMM {
    /// Initializes the AMM pool with Token A and Token B addresses.
    pub fn initialize(e: Env, admin: Address, token_a: Address, token_b: Address) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        admin.require_auth();

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::TokenA, &token_a);
        e.storage().instance().set(&DataKey::TokenB, &token_b);
        set_reserves(&e, 0, 0);
        set_total_shares(&e, 0);
    }

    /// Deposits liquidity into the pool and returns the LP shares minted.
    pub fn deposit(
        e: Env,
        to: Address,
        amount_a: i128,
        amount_b: i128,
        min_a: i128,
        min_b: i128,
    ) -> i128 {
        to.require_auth();

        if amount_a <= 0 || amount_b <= 0 {
            panic!("amounts must be positive");
        }

        if amount_a < min_a || amount_b < min_b {
            panic!("deposit below minimum thresholds");
        }

        let (res_a, res_b) = Self::get_reserves(e.clone());
        let total_shares = Self::get_total_shares(e.clone());

        let shares = if total_shares == 0 {
            let prod = amount_a.checked_mul(amount_b).expect("overflow in deposit calculation");
            isqrt(prod)
        } else {
            let share_a = amount_a
                .checked_mul(total_shares)
                .expect("overflow")
                .checked_div(res_a)
                .expect("div zero");
            let share_b = amount_b
                .checked_mul(total_shares)
                .expect("overflow")
                .checked_div(res_b)
                .expect("div zero");
            if share_a < share_b {
                share_a
            } else {
                share_b
            }
        };

        if shares <= 0 {
            panic!("zero shares minted");
        }

        let token_a = get_token_a(&e);
        let token_b = get_token_b(&e);
        let client_a = token::Client::new(&e, &token_a);
        let client_b = token::Client::new(&e, &token_b);

        client_a.transfer(&to, &e.current_contract_address(), &amount_a);
        client_b.transfer(&to, &e.current_contract_address(), &amount_b);

        let new_res_a = res_a.checked_add(amount_a).expect("overflow");
        let new_res_b = res_b.checked_add(amount_b).expect("overflow");
        set_reserves(&e, new_res_a, new_res_b);

        let new_total_shares = total_shares.checked_add(shares).expect("overflow");
        set_total_shares(&e, new_total_shares);

        let current_user_shares = get_user_share_balance(&e, &to);
        let new_user_shares = current_user_shares.checked_add(shares).expect("overflow");
        set_user_share_balance(&e, &to, new_user_shares);

        shares
    }

    /// Swaps tokens using constant product x * y = k logic with a 0.3% fee.
    /// buy_a == true: User receives Token A, pays Token B.
    /// buy_a == false: User receives Token B, pays Token A.
    pub fn swap(e: Env, to: Address, buy_a: bool, out_amount: i128, max_in: i128) -> i128 {
        to.require_auth();

        if out_amount <= 0 {
            panic!("out_amount must be positive");
        }

        let (res_a, res_b) = Self::get_reserves(e.clone());

        let token_a = get_token_a(&e);
        let token_b = get_token_b(&e);
        let client_a = token::Client::new(&e, &token_a);
        let client_b = token::Client::new(&e, &token_b);

        if buy_a {
            if out_amount >= res_a {
                panic!("insufficient pool liquidity for output");
            }

            // in_b = (res_b * out_a * 1000) / ((res_a - out_a) * 997) + 1
            let num = res_b
                .checked_mul(out_amount)
                .expect("overflow")
                .checked_mul(1000)
                .expect("overflow");
            let den = (res_a - out_amount)
                .checked_mul(997)
                .expect("overflow");
            let in_amount = (num / den).checked_add(1).expect("overflow");

            if in_amount > max_in {
                panic!("slippage limit exceeded");
            }

            client_b.transfer(&to, &e.current_contract_address(), &in_amount);
            client_a.transfer(&e.current_contract_address(), &to, &out_amount);

            let new_res_a = res_a - out_amount;
            let new_res_b = res_b + in_amount;
            set_reserves(&e, new_res_a, new_res_b);

            in_amount
        } else {
            if out_amount >= res_b {
                panic!("insufficient pool liquidity for output");
            }

            // in_a = (res_a * out_b * 1000) / ((res_b - out_b) * 997) + 1
            let num = res_a
                .checked_mul(out_amount)
                .expect("overflow")
                .checked_mul(1000)
                .expect("overflow");
            let den = (res_b - out_amount)
                .checked_mul(997)
                .expect("overflow");
            let in_amount = (num / den).checked_add(1).expect("overflow");

            if in_amount > max_in {
                panic!("slippage limit exceeded");
            }

            client_a.transfer(&to, &e.current_contract_address(), &in_amount);
            client_b.transfer(&e.current_contract_address(), &to, &out_amount);

            let new_res_a = res_a + in_amount;
            let new_res_b = res_b - out_amount;
            set_reserves(&e, new_res_a, new_res_b);

            in_amount
        }
    }

    /// Withdraws liquidity by burning LP shares.
    pub fn withdraw(
        e: Env,
        to: Address,
        share_amount: i128,
        min_a: i128,
        min_b: i128,
    ) -> (i128, i128) {
        to.require_auth();

        if share_amount <= 0 {
            panic!("share_amount must be positive");
        }

        let user_shares = get_user_share_balance(&e, &to);
        if share_amount > user_shares {
            panic!("insufficient user LP share balance");
        }

        let (res_a, res_b) = Self::get_reserves(e.clone());
        let total_shares = Self::get_total_shares(e.clone());

        let amount_a = share_amount
            .checked_mul(res_a)
            .expect("overflow")
            .checked_div(total_shares)
            .expect("zero total shares");

        let amount_b = share_amount
            .checked_mul(res_b)
            .expect("overflow")
            .checked_div(total_shares)
            .expect("zero total shares");

        if amount_a < min_a || amount_b < min_b {
            panic!("withdrawal returned below minimum thresholds");
        }

        let token_a = get_token_a(&e);
        let token_b = get_token_b(&e);
        let client_a = token::Client::new(&e, &token_a);
        let client_b = token::Client::new(&e, &token_b);

        client_a.transfer(&e.current_contract_address(), &to, &amount_a);
        client_b.transfer(&e.current_contract_address(), &to, &amount_b);

        let new_res_a = res_a - amount_a;
        let new_res_b = res_b - amount_b;
        set_reserves(&e, new_res_a, new_res_b);

        let new_total_shares = total_shares - share_amount;
        set_total_shares(&e, new_total_shares);

        let new_user_shares = user_shares - share_amount;
        set_user_share_balance(&e, &to, new_user_shares);

        (amount_a, amount_b)
    }

    /// Returns current pool reserves (ReserveA, ReserveB).
    pub fn get_reserves(e: Env) -> (i128, i128) {
        let res_a = e.storage().instance().get(&DataKey::ReserveA).unwrap_or(0);
        let res_b = e.storage().instance().get(&DataKey::ReserveB).unwrap_or(0);
        (res_a, res_b)
    }

    /// Returns user LP share balance.
    pub fn get_user_shares(e: Env, user: Address) -> i128 {
        get_user_share_balance(&e, &user)
    }

    /// Returns total LP share supply.
    pub fn get_total_shares(e: Env) -> i128 {
        e.storage().instance().get(&DataKey::TotalShares).unwrap_or(0)
    }
}
