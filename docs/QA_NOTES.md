# QA Notes

## Browser Wallet

- Connect a Celo-compatible wallet.
- Refresh once after connecting and confirm the invoice still shows the same payer context.
- Prepare a request using each visible payment rail.
- Confirm the QR code regenerates after amount or token changes.
- Confirm the checkout link preserves merchant, amount, token, note, and customer values.
- Confirm an invalid merchant address is rejected before payment.

## MiniPay

- Open the app inside MiniPay.
- Confirm the wallet auto-connects.
- Confirm the app checks USDm, USDC, and USDT balances.
- Confirm MiniPay does not receive a chain switch prompt.
- Save the checkout link used for each MiniPay smoke test.

## Pre-Release

- Run `npm run typecheck` and resolve any errors before sharing a preview URL.
- Confirm `.env.example` still lists every required public variable after any config change.
