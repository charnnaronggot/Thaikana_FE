# Authenticator login

The compatible auth client supports optional pending MFA responses from the native backend. Deploy this frontend before the backend starts enforcing MFA. Ordinary Sales/Station login behavior stays governed by the server; it does not assign a default Sales role.

Pending challenges and enrollment/recovery secrets remain in memory. QR rendering is local, loaded only for enrollment, with no third-party QR service. The enrollment screen supports manual entry, TOTP validation, one-time recovery-code acknowledgement and safe return to login. Refresh/JWT sessions are accepted only after the server returns a full session. Browser reload during a pending challenge requires login again.

The native API owns enrollment, expiry, single use, lockouts, required grants and reset. Device recovery/reset administration and the wider Users/Station interface remain separate readiness work. Do not treat these screens as full-system UAT approval.

Local verification: Frontend 43 tests and workspace build; native MFA browser acceptance uses an isolated PostgreSQL API, checks enrollment/recovery at 1920×1080, 1194×834, 834×1194 and 390×844, and masks secrets in evidence. Existing Design stylesheet budget warning remains open.
