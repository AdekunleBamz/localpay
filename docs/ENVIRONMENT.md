# Environment Reference

Loka uses public environment variables to select the ledger contract, Celo network, and default stablecoin display values.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Base URL used when payment links are prepared outside the browser. |
| `NEXT_PUBLIC_LOKA_LEDGER_ADDRESS` | Deployed `LokaPayLedger` contract used for receipts. |
| `NEXT_PUBLIC_CELO_CHAIN_ID` | Celo chain id. Use `42220` for mainnet. |
| `NEXT_PUBLIC_LOKA_STABLE_TOKEN` | Default USDm token address shown in the app. |
| `NEXT_PUBLIC_LOKA_STABLE_SYMBOL` | Default stablecoin symbol label. |
| `NEXT_PUBLIC_LOKA_STABLE_DECIMALS` | Default stablecoin decimal precision. |

## Unit Notes

Ledger payments store token amounts in base units. The UI converts human-readable invoice amounts using the selected token decimals before submitting payment.

## Vercel Notes

Update the ledger address in Vercel before promoting a new production build. Browser bundles keep the public variables from the deployment that built them.
