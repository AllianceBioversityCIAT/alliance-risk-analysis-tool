## 2024-05-22 - [Insecure Default Configuration]
**Vulnerability:** Cognito service defaulted to insecure token decoding (bypassing signature verification) if ENVIRONMENT was not exactly 'production'.
**Learning:** Checking for 'production' to enable security features is an anti-pattern (fail-open). It leaves other environments like 'staging' or 'preprod' vulnerable.
**Prevention:** Use a fail-secure approach: default to secure mode and only enable insecure mode for specific environments (dev/test) if explicitly configured.
