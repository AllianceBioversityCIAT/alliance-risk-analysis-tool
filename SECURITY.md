# Security Policy

Thank you for helping keep the CGIAR Agricultural Risk Intelligence Tool secure. This document describes how to report vulnerabilities, which versions are supported, and the known security characteristics of the MVP.

---

## Reporting a vulnerability

**Do not open a public GitHub issue for security concerns.**

Instead, please disclose privately to the Alliance of Bioversity International & CIAT Digital Platforms team. Include:

- A description of the issue and its potential impact
- Steps to reproduce (a minimal proof-of-concept is ideal)
- Any environment details that affect reproduction (browser, Node version, AWS region)
- Whether you have disclosed the issue to any third parties

### Reporting channels

- **Preferred:** email the primary maintainer listed in the project `README.md`
- **GitHub private vulnerability report:** use the *Security → Report a vulnerability* form on the repository
- **For issues involving a maintainer account:** contact the Alliance IBD Digital Platforms department via official Alliance channels rather than GitHub

### What to expect

- Acknowledgement of receipt within five business days.
- Initial assessment and severity classification within ten business days.
- Regular status updates at least once per week until the issue is resolved or a decision is made not to fix.
- Coordinated disclosure once a fix is released, with credit to the reporter unless anonymity is requested.

We do not currently operate a paid bug-bounty programme.

---

## Supported versions

The MVP is pre-1.0. Security fixes are applied only to the current `main` branch and the latest tagged release. Older commits are not patched.

| Version | Supported for security fixes |
|---------|:----------------------------:|
| `main` (unreleased) | ✅ |
| `0.1.x` (current MVP) | ✅ |
| Pre-0.1 tags / branches | ❌ |

Once the tool reaches 1.0 with a public release, this section will be updated to describe the supported-version policy beyond pre-1.0.

---

## Known security characteristics

### Credentials and secrets

- All database passwords, Cognito client secrets, and the Worker Lambda admin token live in AWS Secrets Manager. None are committed to the repository.
- The `.env` and `.env.local` files used for local development are gitignored.
- `aws lambda update-function-configuration --environment` replaces **all** env vars — always re-supply the full set when patching a single value. This gotcha is documented in `CLAUDE.md` and `docs/runbooks/docx-extraction.md`.

### Authentication

- Authentication is backed by AWS Cognito. The dev/test environment decodes tokens without JWKS verification for local developer convenience — do **not** run the `ENVIRONMENT=development` code path in a public-facing deployment.
- Admin actions are gated by a separate `AdminGuard` that inspects the `isAdmin` Cognito group membership.
- JWT tokens are stored in localStorage on the web client with cross-tab synchronisation. Users on shared machines should explicitly sign out.

### Network isolation

- RDS sits in a private VPC with no public ingress. Database access requires either the Worker Lambda's `run-sql` authenticated action or a bastion.
- VPC endpoints are provisioned for Cognito IDP, Bedrock Runtime, Textract, Lambda, and S3 to avoid routing Lambda-to-AWS traffic through a NAT Gateway.
- API Gateway is the only public surface and is fronted by AWS-managed rate limiting plus per-endpoint throttles on sensitive auth routes.

### Upload handling

- Uploads go browser-to-S3 via presigned URLs. The API Lambda never receives the raw file body.
- MIME types are validated server-side against an explicit allow list (`ALLOWED_DOCUMENT_MIME_TYPES` in `packages/shared`). Legacy `.doc` binary format is explicitly rejected.
- Password-protected PDFs and DOCX files are not unlocked. They fail parsing gracefully and are marked `FAILED` with an explanatory error.

### AI-generated content

- Outputs from the Bedrock (Moonshot Kimi K2.5) agents should be reviewed by qualified analysts before being used for investment decisions. The PDF report contains a `DISCLAIMER` page stating this.
- Prompt content is stored in the database and is admin-editable — treat prompts as sensitive operational code. The Prompt Manager has a change-history feature for audit.

### Known limitations

- No mutual-TLS or IP allow-listing on the API Gateway today. Broader network restrictions are a deployment-time concern and should be applied before production exposure.
- No in-app audit log of analyst actions beyond Prisma timestamps. If regulatory audit is required, this gap must be addressed.
- Secrets in CloudWatch logs: defensive coding aims to log only lengths, identifiers, and error codes — never raw user content. Verify this by sampling logs during your deployment's security review.

---

## Dependency management

- Production dependencies are scanned on each CI run (see `.github/workflows/ci.yml`).
- `pnpm audit` should return zero high/critical vulnerabilities before any deploy. A failing audit is not currently a hard CI gate but will become one before the first public release.
- Lock file (`pnpm-lock.yaml`) is committed and must match `package.json` — PRs with lock/manifest mismatches are rejected.

## SBOM (Software Bill of Materials)

A formal SBOM is not yet published. Until it is, consumers can generate one on demand:

```bash
pnpm licenses list > sbom-licenses.txt
pnpm audit --json > sbom-audit.json
```

A published CycloneDX or SPDX SBOM is planned for the first public release.

---

## Thank you

Responsible disclosure makes this tool safer for the agricultural SMEs whose data passes through it. We appreciate researchers, analysts, and partner teams who take the time to report issues privately.
