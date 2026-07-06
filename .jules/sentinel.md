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

## 2024-07-05 - [HIGH] Timing Attack Vulnerability in Admin Token Validation
**Vulnerability:** The Worker Lambda (`worker.ts`) used a simple `===` string comparison (`event.authToken !== expectedToken`) to validate the `WORKER_ADMIN_TOKEN`. This exposed the application to timing attacks, where an attacker could theoretically guess the token character by character based on response times.
**Learning:** Even internal or admin endpoints must use constant-time comparisons for sensitive tokens. Additionally, when using `crypto.timingSafeEqual`, passing buffers of unequal lengths causes a fatal `TypeError`, which could be used as a Denial of Service. Combining `timingSafeEqual` with hashing (like SHA-256) of both values ensures equal buffer lengths regardless of input length. Furthermore, since input payloads from events cannot be guaranteed to be strings at runtime (despite TypeScript types), failing to explicitly validate the type (`typeof input === 'string'`) can lead to runtime exceptions when passed to `crypto.createHash().update()`.
**Prevention:** Always use `crypto.timingSafeEqual` on hashed inputs for sensitive token comparisons. Always validate the runtime type of untrusted inputs before passing them to Node.js crypto functions.
