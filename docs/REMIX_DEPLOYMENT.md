# Remix Deployment

Deploy `contracts/LokaPayLedger.sol` manually from Remix.

## Constructor

```solidity
constructor(
  address initialOwner_,
  address payable treasury_,
  uint256 feeBps_
)
```

Recommended values:

- `initialOwner_`: your owner wallet.
- `treasury_`: your fee wallet, or `0x0000000000000000000000000000000000000000` to use `initialOwner_`.
- `feeBps_`: `0` for no fee, `30` for 0.30%, or `50` for 0.50%.

Keep `feeBps_` below the contract maximum of `500`, which represents 5%.

## App Env

After deploying, set:

```bash
NEXT_PUBLIC_LOKA_LEDGER_ADDRESS=0xDDBc0b6fB1fB0AAaE4321d69B3625ba4CaB2a952
NEXT_PUBLIC_CELO_CHAIN_ID=42220
NEXT_PUBLIC_LOKA_STABLE_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_LOKA_STABLE_SYMBOL=USDm
NEXT_PUBLIC_LOKA_STABLE_DECIMALS=18
```

The app also includes Celo Mainnet USDC and USDT constants through the SDK for MiniPay balance-based token selection.

## Verification

Verify the contract on Celoscan with the same constructor values used in Remix.

Current Celo Mainnet ledger:

```text
0xDDBc0b6fB1fB0AAaE4321d69B3625ba4CaB2a952
```

## Post-Deploy Smoke Check

- Read `owner`, `treasury`, and `feeBps` from the deployed ledger in Remix.
- Create a small test invoice and confirm the emitted receipt includes the expected invoice ID.
- Confirm the app environment points to the same ledger address before sharing the production URL.
