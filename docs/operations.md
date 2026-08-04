# Production Operations Runbook

This runbook covers the API in `pomodoro-node`, the web app in `PomodoroTimer`, and their PostgreSQL database. Complete the pre-deployment acceptance backlog before promoting a release.

## Production inventory and ownership

| Component     | Platform                        | Production address                          | Primary signal                                 |
| ------------- | ------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Web app       | Vercel                          | `https://pomodoro-timer-teal-pi.vercel.app` | page and authenticated-flow checks             |
| API           | Render                          | `https://pomodorotimer-d9n5.onrender.com`   | `GET /api/health`                              |
| Database      | PostgreSQL                      | value is secret-managed as `DATABASE_URL`   | provider health, connections, latency, storage |
| Errors/traces | Sentry when `SENTRY_DSN` is set | provider project                            | new errors and error rate                      |
| Metrics       | API `GET /api/metrics`          | bearer-protected by `METRICS_TOKEN`         | request rate, status, latency, process metrics |

Assign a named release owner and incident commander before each production change. Record provider dashboards, escalation contacts, and credential recovery instructions in the team's private operations system, never in this repository.

## Release preparation

1. Confirm all acceptance items for the release are complete and both repositories' intended commits are pushed.
2. Record the frontend and backend commit SHAs, deployment owner, UTC start time, and rollback owner in the release record.
3. Confirm CI is green. Locally, run `npm run check` in each repository with a dedicated test database and a production API URL for the frontend build.
4. Review dependency audit output and database/index changes. Take an on-demand database snapshot before any data or schema migration.
5. Verify production secrets against each `.env.example`. Generate new independent secrets; never copy example values into production.
6. Confirm `CORS_ORIGINS` contains the exact HTTPS frontend origins and `NEXT_PUBLIC_API_URL` contains the exact HTTPS API origin.
7. Confirm the health monitor, metrics collector, Sentry project, and release owner can receive alerts. Announce the change window.

## Deployment

Deploy backward-compatible API and database changes before the frontend that consumes them.

1. Deploy the recorded backend SHA through Render. Run `npm run db:migrate` before serving traffic and keep the previous successful deployment identified for rollback. The API also applies pending migrations safely during startup.
2. Wait for `GET https://pomodorotimer-d9n5.onrender.com/api/health` to return HTTP 200 with a current ISO timestamp on three consecutive checks.
3. Check backend logs for initialization failures and verify authenticated metrics collection using `Authorization: Bearer $METRICS_TOKEN` from an approved secret-bearing environment.
4. Smoke-test CSRF bootstrap, registration/login, token refresh/logout, timer state, and one write/read cycle against a dedicated smoke-test account. Do not use a real user's account.
5. Deploy the recorded frontend SHA through Vercel with the production `NEXT_PUBLIC_API_URL`.
6. In a private browser session, check the landing page, local timer, registration/login, authenticated timer persistence, logout, PWA manifest/service-worker registration, and one offline reload.
7. Observe errors, HTTP 5xx rate, p95 latency, database connections, and resource usage for at least 15 minutes. Record deployment identifiers and smoke-test results in the release record.

## Rollback

Rollback immediately when authentication, timer data integrity, broad availability, or security is affected. Do not wait for the observation window to end.

1. Stop further promotions and record the first failing request ID and UTC time.
2. If only the frontend is affected, use Vercel to promote the last known-good deployment. Verify it still matches the deployed API contract.
3. If the API is affected, use Render to redeploy the last known-good backend deployment. Roll back the frontend too when the older API is not forward-compatible.
4. Prefer a forward data repair. Restore a database snapshot only for confirmed destructive corruption, because restoring discards valid writes after the snapshot.
5. Repeat health and smoke checks, monitor for 15 minutes, and create auditable revert commits in Git for any rolled-back code before the next deployment.

## Database backup and restore

- Enable PostgreSQL continuous backups with point-in-time recovery when available. Target a recovery point objective of 24 hours or better and a recovery time objective of four hours or better.
- Retain daily backups for at least 14 days and monthly backups according to the approved data-retention policy. Encrypt backups and restrict restore permission to named operators with MFA.
- Create an on-demand snapshot before migrations, bulk cleanup, or retention jobs. Record its identifier and expiration in the release record.
- Test restoration at least quarterly into a new, isolated non-production cluster. Never overwrite production during a drill.
- For a restore, select the last known-good point, restore into a new database, validate table counts, constraints, and representative user/timer relationships, run application smoke tests, then switch `DATABASE_URL` during an announced maintenance window. Preserve the damaged database read-only until the incident review permits deletion.

## Health checks and alerts

Run the public API health check every minute with a 10-second timeout. Alert the on-call owner when any of these conditions hold:

- API health fails twice consecutively or frontend availability fails from two regions.
- HTTP 5xx responses exceed 2% for five minutes, or authentication 5xx responses occur repeatedly.
- p95 API latency exceeds two seconds for ten minutes.
- A new Sentry error affects multiple users, error volume rises sharply, or the deployment introduces an unhandled rejection.
- PostgreSQL reports impaired health, connection usage above 80%, sustained slow queries, storage above 80%, replication lag, or backup failure.
- Serverless/runtime usage, email, push, or observability spend crosses 80% of its approved monthly limit.

Page immediately for suspected account compromise, secret exposure, destructive data loss, or widespread authentication/timer failure. Send lower-severity performance and capacity warnings to the operations queue with a named owner and due date.

## Incident response

1. Declare severity, assign an incident commander, open a timestamped incident log, and freeze unrelated production changes.
2. Establish impact using health checks, request IDs, redacted logs, metrics, Sentry, and database/provider status. Do not place tokens, passwords, email addresses, or raw request bodies in incident channels.
3. Contain the issue: rollback, disable the affected integration, revoke exposed credentials, restrict traffic, or place the service in maintenance mode as appropriate.
4. Communicate confirmed impact and the next update time. For security/privacy events, involve the designated legal/privacy owner before making breach claims.
5. Recover with the smallest verified change, run the deployment smoke suite, and monitor until signals remain healthy for at least 30 minutes.
6. Close with a written review covering timeline, impact, root cause, detection gaps, corrective owners/dates, and whether secret rotation, user notification, or backup validation is required.

## Routine drills

- Monthly: verify alert delivery, provider access, billing alerts, domain renewal, and secret owners.
- Quarterly: restore a backup into isolation and perform a rollback drill for both services.
- After every incident or major architecture change: update this runbook and the smoke-test checklist.
