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
## 2026-03-20 - [HIGH] S3 Denial of Wallet via Unbounded Presigned PUT
**Vulnerability:** The application used `PutObjectCommand` and `getSignedUrl` to generate S3 presigned URLs for uploading assessment documents. This PUT-based approach does not allow restricting the file size dynamically at the S3 level, leaving the system vulnerable to a "Denial of Wallet" attack where malicious users could upload excessively large files (up to 5TB) causing massive S3 storage costs.
**Learning:** Presigned `PUT` URLs lack fine-grained conditions like file size limits. While the application had application-level size validation during the request for the URL, an attacker could ignore the UI and upload a massive file directly using the generated URL.
**Prevention:** Always use `createPresignedPost` instead of `getSignedUrl(PutObjectCommand)` when generating upload credentials. Presigned POST requests support a `Conditions` array where limits like `['content-length-range', 0, 26214400]` can be strictly enforced by S3.
