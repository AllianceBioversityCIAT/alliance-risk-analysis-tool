# Claude Code Hooks Configuration Design

## Overview
This document outlines the design for the automated hooks configuration in `.claude/settings.json` for the Alliance Risk Analysis monorepo project. The goal is to enforce quality gates and protect sensitive files when Claude Code makes modifications, without significantly slowing down the agent's performance.

## Design Approach: Lean Monorepo Hooks

We have chosen a "Lean" configuration. This approach balances the need for immediate feedback and safety against the performance overhead of running heavy checks (like full TypeScript compilation or Prettier on every file) during an active AI session.

### 1. PreToolUse Hook (File Protection)
*   **Purpose:** Prevent Claude from accidentally modifying sensitive configuration files, lockfiles, or version control directories.
*   **Target Actions:** `Edit`, `MultiEdit`, `Write` tools.
*   **Protected Patterns:**
    *   `.env` and `.secret` files (prevent exposing credentials).
    *   `package-lock.json` (ensure lockfiles are only managed by package managers).
    *   `.git/` directory (prevent corruption of repository history).
*   **Mechanism:** A bash command uses `jq` to extract the `file_path` argument from the tool invocation. If the path matches a protected regex pattern, the hook echoes a warning ("BLOCKED: Protected file") and exits with a non-zero status (exit 2). This immediately aborts the tool execution.

### 2. Stop Hook (Linting Feedback)
*   **Purpose:** Ensure all code modifications adhere to the project's ESLint standards across both `@alliance-risk/api` and `@alliance-risk/web`.
*   **Timing:** Runs exactly once at the end of Claude's turn (after all tool calls for that turn have completed).
*   **Mechanism:** The hook navigates to the Git repository root (`git rev-parse --show-toplevel`) and executes `pnpm lint`.
*   **Feedback Loop:** The output of the lint command is piped to `head -50`. This ensures that if linting fails, Claude receives the first 50 lines of error output as feedback. This is sufficient context for Claude to attempt to fix the errors before returning control to the user, without overwhelming the context window with massive log files.

## Future Considerations
If the project requires stricter checks and is willing to accept slightly longer wait times between AI turns, this configuration can be expanded to include:
*   `pnpm tsc --noEmit` in the Stop hook for comprehensive type checking.
*   `PostToolUse` hooks running `npx prettier --write` for instant, per-file formatting.
