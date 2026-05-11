# Receipt Event Check

After a payment confirms, find the `LokaPayment` event for the transaction and compare it with the app receipt.

The event should include the expected invoice ID, payer, merchant, token, amount, fee, and memo hash.
