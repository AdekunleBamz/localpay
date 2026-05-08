# MiniPay Compatibility

Loka is designed around MiniPay stablecoin payments on Celo.

## USDm Default

The app defaults to Celo Mainnet USDm:

```text
0x765DE816845861e75A25fCA122bb6898B8B1282a
```

This address is committed in:

- `src/lib/celo.ts`
- `.env.example`
- `docs/REMIX_DEPLOYMENT.md`

## MiniPay Flow

- The app detects MiniPay through `window.ethereum.isMiniPay` or the browser user agent.
- MiniPay sessions do not call `wallet_switchEthereumChain`.
- The primary checkout token is USDm.
- The contract records payments through `payToken(...)`.

## Web Wallet Flow

Normal browser wallets can use either:

- USDm through `payToken(...)`
- Native CELO through `payNative(...)`

USDm remains the recommended production path for MiniPay.
