# Continuous code quality policy

This project follows **Clean as You Code**: keep new and changed code safe,
reliable, and maintainable while reducing legacy issues incrementally.

## Mandatory project checks
- Preserve and pass existing build, lint/type-check, unit/integration, and release checks.
- Do not introduce confirmed high-impact reliability or security issues.
- Review all newly reported security hotspots; document false positives with evidence.
- Add targeted regression tests for behavior changes and security-sensitive code.
- Review AI feedback before merging. AI review is advisory, not a substitute for tests.

## SonarQube Cloud onboarding (repository maintainer)
1. Sign in to https://sonarcloud.io with GitHub and import this **public** repository
   through the SonarQube Cloud GitHub integration (or confirm it is already imported).
2. Prefer **Automatic analysis** where supported; keep existing CI coverage intact.
   Only use CI-based SonarScanner if automatic analysis is not suitable.
   Never configure both scanning modes for the same project.
3. Use the built-in **Sonar way** quality profile and new-code Quality Gate.
   Configure the New Code Definition for the project's delivery cadence.
4. Verify analyses of the main branch **and** a pull request. If coverage data is
   required, configure the correct language-specific coverage report in CI.
5. After the check has passed at least once, enable the Sonar Quality Gate status
   as a required GitHub branch-protection/ruleset check if supported by the repo's
   GitHub plan. Do not require a nonexistent check.

## CodeRabbit onboarding (repository maintainer)
1. Install the official CodeRabbit GitHub App for this **public** repository at
   https://github.com/apps/coderabbitai (subject to its current OSS terms/limits).
2. The root `.coderabbit.yaml` configures the review style and project guidance.
   The config alone does **not** install/authorize the app.
3. Verify the next PR gets a focused review; treat comments as proposals and
   distinguish actionable defects from preferences and false positives.

## Merge policy
- No direct push to a protected main branch for normal changes.
- Resolve critical findings; document exceptions and their rationale.
- Keep CI checks and reviews visible in PRs.
- Do not add tokens or credentials to Git history. Use GitHub Secrets for CI.
- Forked upstream repositories have their own governance; apply this policy only
  to repositories you maintain, not to upstream maintainers' projects.
