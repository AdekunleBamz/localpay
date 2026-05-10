# Loka

Loka is a MiniPay-first merchant payment request app for Celo. Merchants prepare stablecoin or CELO requests, share a checkout link or QR code, and receive funds directly while the ledger contract records an onchain receipt.

## Local Development

```bash
npm install
npm run dev
```

Use `.env.local` for local values. The committed `.env.example` only documents the public variables the app expects.

## Environment

Copy `.env.example` to `.env.local` and add the deployed ledger address after Remix deployment.

```bash
NEXT_PUBLIC_LOKA_LEDGER_ADDRESS=0xDDBc0b6fB1fB0AAaE4321d69B3625ba4CaB2a952
NEXT_PUBLIC_CELO_CHAIN_ID=42220
NEXT_PUBLIC_LOKA_STABLE_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_LOKA_STABLE_SYMBOL=USDm
NEXT_PUBLIC_LOKA_STABLE_DECIMALS=18
```

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for the purpose of each public variable.

## Contract

See [docs/REMIX_DEPLOYMENT.md](docs/REMIX_DEPLOYMENT.md).

Deployed Celo Mainnet ledger:

```text
0xDDBc0b6fB1fB0AAaE4321d69B3625ba4CaB2a952
```

## MiniPay

Loka auto-connects inside MiniPay, checks USDm/USDC/USDT balances, and selects a stablecoin that can cover the request. See [docs/MINIPAY_COMPATIBILITY.md](docs/MINIPAY_COMPATIBILITY.md).

## Release Checks

Before deploying to Vercel, run:

```bash
npm run lint
npm run build
```

After deployment, open one merchant request in a normal browser and one inside MiniPay. Confirm the selected token, amount, and merchant address match before sending funds.

Use [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) as the full production readiness pass.
