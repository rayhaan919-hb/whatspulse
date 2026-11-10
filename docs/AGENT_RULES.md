# Agent Execution Rules & Ground Guidelines

These rules govern all engineering work on WhatsPulse CRM. Every agent and contributor must follow these principles strictly:

1. **One Stop at a Time on Dedicated Branches:**
   - Work one stop at a time on its own git branch (branch name given in the prompt).
   - Commit in small, logical commits with clear descriptive messages.
   - Never work directly on `main`.

2. **Check Before Implementing:**
   - Before changing anything, check whether the item or abstraction already exists in the repository.
   - Do not duplicate or rewrite working code.

3. **Test-Driven Development (TDD):**
   - Write failing tests FIRST in `test-e2e.mjs` (or a sibling test file).
   - Run tests and confirm they fail as expected.
   - Implement the minimal, clean code required until all tests pass.

4. **Safe, Additive Database Migrations:**
   - Database changes are new SQL migration files only (in `supabase/migrations/`).
   - Never edit already-applied migrations.
   - No destructive data operations (no dropping columns or tables without explicit request).
   - Assume migrations are tested on a separate Supabase project/branch, never directly on real production data.

5. **Strict Code & Security Standards:**
   - TypeScript strict mode enabled: absolutely no `any`.
   - Never leak or store secrets, tokens, or credentials in code, client bundles, or logs.
   - No new heavy external dependencies without a concise, one-line justification.

6. **Authoritative Meta WhatsApp API Compliance:**
   - Never invent Meta API fields, endpoints, or error behavior.
   - Check `docs/META_VERIFY.md` before implementing any Meta-specific functionality.
   - Mark anything unconfirmed with `// VERIFY` in the code and list it explicitly in your stop summary.
   - Resolve documentation links only against Meta's current documentation index (`https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt`); never cite a link you cannot open.

7. **Design Integrity:**
   - Keep the existing warm editorial palette and design tokens intact. Do not inject clashing styles or disrupt the visual harmony.

8. **Standardized Stop Protocol:**
   - End every stop by running `tsc`, `lint`, `build`, and `test-e2e.mjs`.
   - Append a structured summary to `docs/PHASE_LOG.md` detailing:
     - Files changed
     - Migrations added
     - Environment variables added
     - Tests added and results
     - `// VERIFY` items needing confirmation
     - Anything skipped and why
   - **STOP** and wait for user review after each stop.
