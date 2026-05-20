# API Invoice Method Check

- Call the invoice API with an unsupported HTTP method.
- Confirm the response rejects the method without leaking implementation details.
- Verify the app only sends the documented invoice method in production.
