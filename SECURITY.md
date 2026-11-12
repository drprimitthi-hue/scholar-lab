# Security design and verification — Phase 1

## Model
| Layer | Protection |
|---|---|
| Database writes | **No browser can write anything.** Firestore rules deny all client writes. Every change goes through a server API route that verifies the signed-in user's token (revocation checked), role, active status and 2FA, validates input (strict schemas, size limits, unknown fields rejected) and writes the audit entry in the same atomic batch. |
| Database reads | Rules allow reads per role: supervisor (with 2FA) all; mentor (with 2FA) only records listing them as mentor; scholar/alumni only their own records; public only `publicSite/*` (non-sensitive lab info). Private supervisor notes are in a separate supervisor-only collection. |
| Roles | Stored as server-set custom claims; users cannot change them. Supervisor accounts cannot be created through the app. |
| Sign-in | Email/password with enforced policy (≥10 chars, upper/lower/digit), email-enumeration protection, authenticator-app 2FA (required for supervisor and mentors), forced first-login password change, idle sign-out, fresh sign-in required for deletion. |
| Files | Private bucket. Browsers may only upload new PDF/PNG/JPEG/WebP ≤10 MB into a scholar's own folder (no overwrite/delete/read). Downloads are 5-minute signed links issued after an access check. |
| Secrets | Service-account key only in Vercel encrypted env vars; never in the browser or repository (`.gitignore` covers keys and `.env*`). The Firebase web config is public by design. |
| Browser | Nonce-based Content-Security-Policy with `strict-dynamic`, HSTS (preload), `X-Frame-Options: DENY`/`frame-ancestors 'none'`, nosniff, strict referrer, restrictive Permissions-Policy, `no-store` on API responses. React escaping; no raw HTML rendering. |
| Abuse | Firebase Auth rate limits; per-user API rate limit (best effort); optional App Check enforcement. |
| Records | Write-once audit log; archive instead of delete; deletion only by supervisor with a 7-day restore window, file + record purge, audit anonymisation and a receipt. |
| Privacy | No AI or third-party analytics; location never stored (only on-campus yes/no); data region chosen at setup. |
| Supply chain | Pinned versions, `npm audit` gate in CI, Dependabot weekly. |

## What was verified (9 Nov 2026)
- TypeScript strict type-check: passes.
- Unit tests (22): authorization policy (roles, 2FA, inactive accounts, recent sign-in), record-access rules, input validation (mass-assignment, path traversal, dates, sizes), date/milestone logic — **all pass**.
- Production build: passes.
- Running server: security headers and per-request CSP nonce present; API rejects missing, malformed, oversized and forged (`alg:none`, claims "supervisor") tokens with 401; cron endpoint rejects missing/wrong secret.
- Headless-browser check: public page and login render under the strict CSP with no CSP violations; protected pages redirect to sign-in.
- `npm audit --omit=dev`: no high/critical issues. Remaining: 6 *moderate* advisories in `glob`/`minimatch`, pulled in by Google's server library for temp-file cleanup (no user input reaches them).

## Not yet verified — do this before real data
- **Security-rules tests** (`tests/rules`, 12 test groups: no client writes, scholar isolation, mentor scope, 2FA gating, private notes, storage upload/read) could not run in the build environment (the Firebase emulator download was blocked). They run automatically in GitHub Actions on every push (`.github/workflows/ci.yml`); confirm the first CI run is green.
- End-to-end run against your real Firebase project (first sign-in, 2FA enrolment, add scholar, upload, leave, deletion cron).

## Phase 2 additions (Literature)
- Projects, literature, reading plans, Reading Cards and suggestions follow the same model: **browsers only read**; all changes go through the server with role checks and audit entries.
- Project data is visible only to its scholars, their mentors and the supervisor. A scholar can read only their own plan and cards.
- Other scholars' cards are visible **only when the supervisor opens them to the group, and only once accepted** (enforced in the database rules, not just hidden in the page).
- The server refuses work on papers that are not yet released to the scholar, and accepted cards are locked; every submission and resubmission is kept in the audit log.
- Literature links must be `http(s)://` (checked in the browser and again on the server), so script links cannot be planted. Links open with `noopener noreferrer`.
- CSV import is size-limited and validated row by row; CSV/Excel exports neutralise spreadsheet formulas (cells starting with `= + - @`).
- New rules tests cover project membership, literature access, plan privacy and group-card visibility.
- Verified here: type-check, 33 unit tests (incl. CSV parsing/injection, batching, release gating, card validation), production build, route protection, and a rendered check of the charts.

## v0.3 additions (setup, licences, Control Centre)
- **Setup wizard** works once and only with the `SETUP_TOKEN` (compared in constant time, rate-limited); afterwards it is permanently disabled.
- **Licences** are Ed25519-signed by the Control Centre; labs hold only the public key (they can verify, never create). Status replies from the Control Centre are signed too, so they cannot be faked. If the Control Centre is unreachable, labs keep working until their licence's expiry date.
- **Enforcement** is on the server: a read-only or locked lab rejects writes (or everything) regardless of what the browser shows.
- **Heartbeat** sends only the licence token, app version and domain — never personal or scholar data.
- **Control Centre**: browsers have no database access at all (rules deny everything); one super-admin with 2FA; sensitive actions (licences, status, secrets, releases) need a fresh sign-in; pages are excluded from search engines; every action is logged.
- **Releases** use a GitHub token limited to one repository; `stable` is only fast-forwarded (no history rewrite).
- **Data export** for the supervisor (also while read-only), with fresh sign-in, logged.
- Verified here: 40 + 4 unit tests (licence signing/tamper/expiry/revocation, shared-code identity, alerts, validation), both apps build, endpoints reject wrong setup codes, missing/forged tokens and bad input, pages render without errors. The calls to Google's management APIs (enable sign-in, rules, indexes) could not be exercised from the build environment; the wizard reports each step and how to fix it if one fails.

## Phase 3 additions (public website)
- The public site reads **only** the `public*` mirror collections. They are written by the server alone (rules forbid any browser write) and contain only publishable fields; private sources (`siteContent`, `siteNews`, `siteOpenings`, `sitePublications`) are supervisor-only.
- People appear only with the scholar's own recorded consent, unless hidden by the supervisor; deletion, disabling or withdrawn consent removes them (and their name from public projects) immediately.
- All public text is rendered as plain text (no HTML); external links must be `http(s)` and open with `noopener noreferrer`; accent colour is validated before use.
- `robots.txt` excludes the members' area and APIs from search engines.
- Verified here: 44 unit tests (lab app) + 4 (Control Centre), builds, every public page renders (200) with sample data, unknown project → 404, no browser errors.

## Phase 4 additions (concepts & seminars)
- All writes go through API routes with zod strict schemas and audit entries; clients still cannot write Firestore directly.
- Concept notes use the same group gate as reading cards: `groupUids` is server-maintained and only populated when the supervisor opens the group.
- Peer scores: the server checks peer scoring is on, the rater was marked present, and the rater is not the speaker. The score id is a hash of session+rater, so one rater = one score per speaker (re-scoring overwrites). Peer rater names are never stored.
- Slides are private Storage objects; downloads use 5-minute signed URLs, allowed only for lab members of that session.
- Sessions cannot be deleted once completed or scored (official record). Concepts cannot be deleted once used or depended on.
- Scores, tasks and notes are scholar-scoped: scholars read only their own, mentors only their mentees'.

## Phase 5 additions (prototypes & outputs)
- Supervisor-only statuses (submitted, accepted, published, filed, granted, released, final…) are enforced on the server from one pipeline table (`src/lib/domain/outputs.ts`, unit-tested); once reached, only the supervisor can edit the record.
- A scholar can register an output or a prototype only with themselves as the member/owner; adding other people is for the supervisor or a mentor (for mentors, only their mentees). Editing never silently drops members the editor cannot see.
- Output reads: supervisor, the members' mentors, the members. Prototype and logbook reads: members of that project. List queries are constrained so the rules can prove them.
- Website mirrors carry only bibliographic fields (authors, title, venue, year, type, link) and only when the supervisor made the output public AND it reached a publishable status. Private notes, files and history never leave the private collection.
- Attached files go to the uploader's own private folder; a server-only `fileIndex` maps each file to its record so `/api/files` can check access before issuing a 5-minute link.
- Logbook entries and attached files are append-only. Prototypes are not deletable (paused/done instead).
- Purge (deletion after the 7-day window) removes the person from outputs and prototypes and anonymises their logbook entries and history, keeping the lab record and printed author lists.

## Phase 6 additions (My Office)
- Every office collection is readable only by the supervisor with 2FA (rules tests cover mentors, scholars, a supervisor without 2FA and anonymous users); all writes go through supervisor-only API routes with strict schemas.
- Office files live in a separate private folder `office/{supervisorUid}/` that only the supervisor can upload to; downloads use 5-minute links issued only to that supervisor. Attached files are checked on the server (exists, owner's folder, PDF/image type).
- The audit log records that an office item was created/changed/deleted, but not its content, so private notes are not copied into the audit trail.
- Evidence bundles are built on the server from the supervisor's own files (limits: 200 files, 60 MB), stored privately, delivered via a 10-minute link, rate-limited, and deleted automatically after 7 days (originals are kept).
- Duty reminders use calendar files the supervisor imports into their own calendar; no email/SMS provider, no third-party service and no personal data leaves the platform.
- Semesters with diary entries cannot be deleted, and subjects with recorded classes cannot be removed (teaching history is kept). Orders and meetings with linked duties cannot be deleted until the duty is re-linked.
- “Export all data” now includes every collection added in Phases 2–6 (it had missed some; fixed).

## v1.0 additions
- `tests/unit/routes.test.ts` reads every API route and fails the build if a handler is not wrapped, does not authenticate (user sign-in, or a constant-time-checked secret for the two scheduled jobs and the one-time setup), or takes a body without schema validation. It also fails if browser code uses Firestore write functions, `eval`, `new Function`, `innerHTML` or raw HTML injection.
- Releases to other labs are refused unless the GitHub CI run for that exact commit passed (typecheck, unit tests, database and storage rules tests, dependency audit, build).
- 2FA reset for mentors requires a fresh supervisor sign-in (≤ 15 minutes) and revokes the mentor's sessions.
- Reports are computed in the browser from records the viewer is already allowed to read; they add no new access paths.
- Known accepted risk: six "moderate" advisories in a sub-dependency of Google's official Admin SDK (google-gax → glob/minimatch); not reachable from user input. Dependabot will propose the fix when Google ships it.

## v1.1: file storage on Cloudinary (optional)
- No unsigned upload presets. The browser first asks `/api/files/ticket`; the server checks the user may write to that folder (scholar: own folder; supervisor: a scholar's folder or own office), chooses the exact file name, and signs `public_id`, `type=authenticated`, `overwrite=false` and a timestamp with the API secret, which never leaves the server. Cloudinary rejects any other path or a reused/old signature.
- Files are `authenticated`: no public URL works. `/api/files` still checks who may see a file, then returns a Cloudinary download link that expires in 5 minutes (evidence bundles: 10 minutes).
- Content Security Policy allows the browser to contact only `https://api.cloudinary.com/v1_1/<this lab's cloud>/`.
- Server-side checks of uploaded files (exists, owner folder, PDF/image type) work the same for both providers, through `src/lib/server/storage.ts`.
- Trade-off to tell each faculty member: Cloudinary keeps files on its own servers (generally outside India); the database stays in the lab's Firebase region. Labs that need files in India use Firebase Storage.
- Unit tests sign Cloudinary's documented example exactly and exercise every Cloudinary call against a simulated API (no live account in CI).
