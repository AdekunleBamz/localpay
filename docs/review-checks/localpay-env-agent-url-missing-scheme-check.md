# LocalPay Env Agent URL Missing Scheme Check

Configure the invoice agent URL without `https://` or `http://`.
Confirm LocalPay rejects the value or normalizes it safely.
Verify invoice generation does not send requests to an unintended relative path.
