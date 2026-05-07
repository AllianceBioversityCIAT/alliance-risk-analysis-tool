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

## 2024-05-23 - Prevent IDOR and Existence Leakage via Direct Database Lookups
**Vulnerability:** Several endpoints performed database lookups using `findUnique` with just the resource `id`, followed by an application-level check throwing `ForbiddenException` if the `userId` didn't match. This exposes the existence of resources belonging to other users (Information Disclosure / Existence Leakage) and increases the risk of IDOR if the subsequent check is ever skipped or flawed.
**Learning:** Checking ownership *after* retrieving the resource leaks information about whether the resource exists at all. To truly prevent information disclosure and enforce strict ownership, the database query itself must include both the resource ID and the user ID.
**Prevention:** Always use `findFirst` (or equivalent) with a compound `where` clause (e.g., `{ id, userId }`) when retrieving user-owned resources, and throw a generic `NotFoundException` if no record is returned.
