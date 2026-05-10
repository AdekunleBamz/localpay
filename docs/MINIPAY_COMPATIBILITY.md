# MiniPay Compatibility

Loka is designed around MiniPay stablecoin payments on Celo.

## Stablecoin Defaults

The app supports MiniPay stablecoin checkout with USDm, USDC, and USDT on Celo Mainnet.

| Token | Address |
| --- | --- |
| USDm | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| USDT | `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e` |

These addresses are committed in:

- `@bamzzstudio/loka-sdk`
- `docs/REMIX_DEPLOYMENT.md`

The `.env.example` keeps the USDm override fields for deployments that want to customize the default USDm address or symbol.

## MiniPay Flow

- The app detects MiniPay through `window.ethereum.isMiniPay` or the browser user agent.
- The connected account still comes from `eth_requestAccounts` after detection.
- The app auto-connects the MiniPay wallet on launch.
- The app checks USDm, USDC, and USDT balances and selects a stablecoin that can cover the request.
- MiniPay sessions do not call `wallet_switchEthereumChain`.
- The contract records payments through `payToken(...)`.

## Token Selection Checks

- Confirm the requested amount is converted with the selected token decimals before payment.
- Confirm the displayed token symbol matches the token address sent to `payToken(...)`.
- Confirm MiniPay requests stay on Celo mainnet and do not prompt the user to switch chains.

## Web Wallet Flow

Normal browser wallets can use:

- USDm, USDC, or USDT through `payToken(...)`
- Native CELO through `payNative(...)`

USDm remains the recommended production path for MiniPay.
