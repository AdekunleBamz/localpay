# Release Checklist

- Run `npm run lint`.
- Run `npm run build`.
- Confirm `NEXT_PUBLIC_LOKA_LEDGER_ADDRESS` matches the intended ledger.
- Prepare a small invoice in a normal browser wallet.
- Prepare a small invoice inside MiniPay.
- Confirm the displayed merchant address matches the receiving wallet.
- Confirm the selected token and amount match the request before payment.
- Confirm Celoscan shows a `LokaPayment` event after a test payment.
