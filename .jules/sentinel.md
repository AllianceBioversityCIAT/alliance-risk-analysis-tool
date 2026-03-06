# Sentinel's Security Journal

## 2024-05-22 - Prevent User Enumeration in Auth Flows
**Vulnerability:** Default error handling in `CognitoService` exposed user existence by returning 404 for `UserNotFoundException` vs 401 for `NotAuthorizedException` during login and forgot password flows.
**Learning:** Generic error mapping (useful for admin APIs) is dangerous for public authentication endpoints. Attackers could enumerate valid email addresses.
**Prevention:** Explicitly catch `UserNotFoundException` in public auth methods (`login`, `forgotPassword`) and return generic "Invalid credentials" (401) or silent success to mask user existence.

## 2026-03-05 - Remove SQL Injection Vulnerability in Worker Lambda
**Vulnerability:** The worker lambda handler (`packages/api/src/worker.ts`) allowed execution of arbitrary, unsanitized SQL queries provided in the `event.sql` payload when `event.action` was set to `run-sql`. This was performed via `prisma.$executeRawUnsafe(stmt)`.
**Learning:** Utilizing serverless functions to perform raw database seeding or migrations directly from unvalidated inputs is highly dangerous and opens the entire database to manipulation and extraction. Any infrastructure provisioning scripts or admin tasks should use dedicated, strongly authenticated mechanisms rather than embedding backdoors into general-purpose workers.
**Prevention:** Removed the raw SQL execution backdoor entirely. Rely on secure, authenticated migration pipelines rather than passing arbitrary SQL commands into functions that lack their own robust authorization layer.
