#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env};

fn create_token<'a>(e: &Env, admin: &Address) -> (Address, token::Client<'a>, token::StellarAssetClient<'a>) {
    let sac = e.register_stellar_asset_contract_v2(admin.clone());
    let addr = sac.address();
    (
        addr.clone(),
        token::Client::new(e, &addr),
        token::StellarAssetClient::new(e, &addr),
    )
}

#[test]
fn test_amm_flow() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    let (token_a, client_a, admin_a) = create_token(&e, &admin);
    let (token_b, client_b, admin_b) = create_token(&e, &admin);

    // Mint initial funds to user
    admin_a.mint(&user, &100_000_000);
    admin_b.mint(&user, &100_000_000);

    let contract_id = e.register(SorobanAMM, ());
    let client = SorobanAMMClient::new(&e, &contract_id);

    // 1. Initialize
    client.initialize(&admin, &token_a, &token_b);

    let (res_a, res_b) = client.get_reserves();
    assert_eq!(res_a, 0);
    assert_eq!(res_b, 0);

    // 2. Initial Deposit
    let shares = client.deposit(&user, &10_000_000, &10_000_000, &1, &1);
    assert!(shares > 0);

    let (res_a, res_b) = client.get_reserves();
    assert_eq!(res_a, 10_000_000);
    assert_eq!(res_b, 10_000_000);
    assert_eq!(client.get_total_shares(), shares);
    assert_eq!(client.get_user_shares(&user), shares);

    // 3. Swap: user wants 1,000,000 Token A, pays Token B
    let in_b = client.swap(&user, &true, &1_000_000, &2_000_000);
    assert!(in_b > 0);

    let (res_a_after, res_b_after) = client.get_reserves();
    assert_eq!(res_a_after, 9_000_000);
    assert_eq!(res_b_after, 10_000_000 + in_b);

    // 4. Withdraw half of shares
    let half_shares = shares / 2;
    let (withdrawn_a, withdrawn_b) = client.withdraw(&user, &half_shares, &1, &1);
    assert!(withdrawn_a > 0);
    assert!(withdrawn_b > 0);

    let (res_a_final, res_b_final) = client.get_reserves();
    assert_eq!(res_a_final, 9_000_000 - withdrawn_a);
    assert_eq!(res_b_final, (10_000_000 + in_b) - withdrawn_b);
}
