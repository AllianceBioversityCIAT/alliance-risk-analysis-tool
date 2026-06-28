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

## 2024-05-18 - Prevent Timing Attacks on Secrets Manager Tokens
**Vulnerability:** Comparing sensitive tokens (e.g., `WORKER_ADMIN_TOKEN`) using strict equality (`===`) exposes the application to timing attacks, allowing attackers to guess the token character by character based on response times. Furthermore, using `crypto.timingSafeEqual` directly on user input without type checking or hashing can lead to fatal `TypeError` exceptions if the buffer lengths mismatch or the input is not a string.
**Learning:** `crypto.timingSafeEqual` strictly requires arguments to be of the exact same length (e.g., same Buffer size) and valid types. Direct comparison of variable-length tokens or passing non-string payloads can crash the process (Denial of Service). Hashing both the expected and provided tokens (e.g., with SHA-256) before passing them to `timingSafeEqual` normalizes their lengths to 32 bytes and ensures safety.
**Prevention:** Always use runtime type checking (e.g., `typeof token === 'string'`) followed by `crypto.createHash('sha256').update(token).digest()` on both the expected and provided secrets. Then, use `crypto.timingSafeEqual(expectedHash, providedHash)` to safely compare the hashed buffers in constant time.
