# LocalPay Merchant History Duplicate Row Key Check

Load merchant history with two payments sharing the same invoice id but different hashes.
Confirm each row remains independently selectable.
Verify receipt links use transaction hash plus invoice context where needed.
