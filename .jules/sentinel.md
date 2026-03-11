# Sentinel's Security Journal

## 2024-05-22 - Prevent User Enumeration in Auth Flows
**Vulnerability:** Default error handling in `CognitoService` exposed user existence by returning 404 for `UserNotFoundException` vs 401 for `NotAuthorizedException` during login and forgot password flows.
**Learning:** Generic error mapping (useful for admin APIs) is dangerous for public authentication endpoints. Attackers could enumerate valid email addresses.
**Prevention:** Explicitly catch `UserNotFoundException` in public auth methods (`login`, `forgotPassword`) and return generic "Invalid credentials" (401) or silent success to mask user existence.

## 2026-03-02 - Missing Rate Limit on Password Change Endpoint
**Vulnerability:** The `changePassword` endpoint (`/api/auth/change-password`) did not have rate limiting (`@Throttle`), leaving it vulnerable to brute-force attacks against authenticated sessions where an attacker could try multiple previous passwords to compromise the account.
**Learning:** Even authenticated endpoints that handle sensitive operations like password changes need rate limiting. The assumption that only public auth endpoints (like login) need rate limits is dangerous.
**Prevention:** Ensure `@Throttle` is applied consistently across all authentication and password-related endpoints, regardless of their auth requirements.

## 2026-03-11 - Unauthenticated SQL Execution in Lambda
**Vulnerability:** A Lambda function (`worker.ts`) accepted a payload with an action `run-sql` and directly executed the provided SQL string against the production database using `prisma.$executeRawUnsafe(stmt)`. This is a critical command injection/SQL injection vulnerability.
**Learning:** Administrative tasks or "backdoors" like remote migrations via Lambda payloads must be strictly authenticated and authorized, rather than relying on the obscurity of the Lambda ARN or VPC.
**Prevention:** Never use `$executeRawUnsafe` or similar raw execution methods with unvalidated, unauthenticated input from a Lambda event payload. Use proper CI/CD migration tools or implement robust authentication (e.g., signed tokens, IAM role validation) for administrative functions.
