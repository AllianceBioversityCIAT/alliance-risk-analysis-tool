# Sentinel's Security Journal

## 2024-05-22 - Prevent User Enumeration in Auth Flows
**Vulnerability:** Default error handling in `CognitoService` exposed user existence by returning 404 for `UserNotFoundException` vs 401 for `NotAuthorizedException` during login and forgot password flows.
**Learning:** Generic error mapping (useful for admin APIs) is dangerous for public authentication endpoints. Attackers could enumerate valid email addresses.
**Prevention:** Explicitly catch `UserNotFoundException` in public auth methods (`login`, `forgotPassword`) and return generic "Invalid credentials" (401) or silent success to mask user existence.

## 2026-03-02 - Missing Rate Limit on Password Change Endpoint
**Vulnerability:** The `changePassword` endpoint (`/api/auth/change-password`) did not have rate limiting (`@Throttle`), leaving it vulnerable to brute-force attacks against authenticated sessions where an attacker could try multiple previous passwords to compromise the account.
**Learning:** Even authenticated endpoints that handle sensitive operations like password changes need rate limiting. The assumption that only public auth endpoints (like login) need rate limits is dangerous.
**Prevention:** Ensure `@Throttle` is applied consistently across all authentication and password-related endpoints, regardless of their auth requirements.

## 2026-03-10 - Missing Rate Limit on Admin Reset Password Endpoint
**Vulnerability:** The admin `resetPassword` endpoint (`/api/admin/users/:username/reset-password`) did not have rate limiting (`@Throttle`), leaving it vulnerable to abuse and potential DoS by a compromised admin account spamming resets.
**Learning:** Admin endpoints, even when authenticated and protected by strict roles, should be rate-limited, especially those performing sensitive operations like resetting passwords.
**Prevention:** Ensure `@Throttle` is applied to sensitive admin operations as defense-in-depth, even when protected by role-based access control.
## 2026-03-11 - [CRITICAL] Unauthenticated SQL Execution in Worker Lambda
**Vulnerability:** The Worker Lambda (`worker.ts`) accepted a `run-sql` action payload and executed arbitrary SQL via `prisma.$executeRawUnsafe()` without any authentication or authorization.
**Learning:** Administrative backdoors that rely on obscurity (Lambda ARN, VPC isolation) are insufficient security controls. Any endpoint that executes raw SQL must have proper authentication.
**Fix:** Added `WORKER_ADMIN_TOKEN` (auto-generated 64-char secret in Secrets Manager: `alliance-risk/worker-admin-token`). The `run-sql` action now requires `authToken` in the payload matching the env var. `migrate-remote.sh` fetches the token from Secrets Manager before invoking.

## 2026-03-12 - [HIGH] Timing Attack Vulnerability in Worker Admin Auth
**Vulnerability:** The `isWorkerAdminAuthorized` function used a standard string inequality operator (`!==`) to compare the provided `authToken` against the `WORKER_ADMIN_TOKEN` secret. This exposed the endpoint to timing attacks, where an attacker could theoretically determine the expected token character-by-character based on the time it takes the comparison to fail.
**Learning:** Cryptographic secrets and authentication tokens should never be compared using standard string comparison operators (`===` or `!==`) because they "short-circuit" and return early as soon as a mismatch is found, leaking length and character information via timing differences. Furthermore, `crypto.timingSafeEqual` throws a fatal `TypeError` if the provided buffers/strings are not of equal length or if non-string types are provided, making type validation and hashing crucial.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing secrets. To ensure equal buffer lengths and prevent fatal errors, hash both the expected and provided strings (e.g., using SHA-256) before passing them to `timingSafeEqual`. Always validate that user-provided inputs are strings (`typeof input === 'string'`) before hashing.
