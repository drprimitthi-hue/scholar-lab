# Scholar Lab Platform — v1.1

A private, secure web app for a research lab: scholars (Bachelor / Master / PhD), mentors and the supervisor,
plus a public lab page. **One separate deployment per faculty member** (own GitHub repo, Vercel project,
Firebase project). Nothing institution-specific is in the code — everything is set in **Settings**.

## What Phase 1 includes
- Sign-in with email + password; **authenticator-app 2FA required** for supervisor and mentors; forced password change on first sign-in; automatic sign-out when idle.
- Roles: supervisor, mentor (assigned scholars only), scholar (own record only), alumni (read-only).
- Accounts created only by the supervisor (temporary password shown once). No self-registration.
- Scholar enrolment record (academic, contact, research-degree details, prior qualifications).
- Degree milestones generated from editable programme templates; submit-with-evidence → approve; live progress %, timeline, overdue flags.
- Presence check-in/out (optional campus check that stores only yes/no), corrections with reasons, 60-day heatmap.
- Leave: apply (with document), balances by type, approve/reject (mentor optional), cancel.
- Private documents per scholar (PDF/images ≤ 10 MB) — downloadable only via 5-minute signed links.
- Private supervisor notes (never visible to scholars or mentors).
- Write-once audit log of every change.
- Archive (alumni) instead of delete; supervisor-only deletion with fresh sign-in, typed-name confirmation, 7-day restore window, receipt.
- Settings: lab identity, programmes, leave types/quotas, weekly offs, holidays, statuses, mentor permissions, campus check, idle timeout, milestone templates.
- Light theme with a configurable accent colour.

## What Phase 2 adds (Literature)
- **Projects** with assigned scholars (mentors follow automatically), objectives, dates and status.
- **Literature CSV upload** per project (links only; template downloadable; validated row by row), export, remove unused items.
- **Reading plans** per scholar: daily reading budget → daily batches in reading order (reviews → core → supporting → optional, by theme), skipping weekly offs, holidays and approved leave. Re-plan keeps past batches; move any paper to another batch.
- **Release rules** per project: by date, by completion (e.g. 80% accepted), or both.
- **Today's reading** page for scholars: open paper (logged), write **Reading Card** (problem, method, setup, key result, limitations, 3 concepts, relevance, citable claim; minimum words), revise when asked.
- **Review queue** for supervisor and mentors: accept or ask for revision with a comment; accepted cards are locked.
- **Group visibility switch**: scholars see each other's accepted cards only when you turn it on.
- **Synthesis**: matrix (Excel/CSV export), gap register (limitations by theme), concept index.
- **Paper suggestions** from scholars → you add them to the list.
- **Charts**: reading burn-up (planned vs submitted vs accepted), status funnel, daily activity heatmap (offs/leave shown separately); dashboard shows cohort heatmap and cards waiting.



## What Phase 3 adds (public lab website)
- Public pages at the site's root: **Home** (hero, live numbers, themes, latest news), **Research** (about, themes, public projects with their own pages), **People** (PI profile with links, current scholars by level, alumni), **Publications** (by year), **News**, **Join us** (open positions), **Contact**. Search-engine friendly (server-rendered, sitemap.xml, robots.txt keeps the members' area out of search).
- **Lab website** editor (supervisor): content (about, research themes, PI bio and profile links, contact), news, open positions, publications, who is shown, rebuild tool.
- **Updates itself**: projects marked public, people, and automatic news ("New project …", "Congratulations … completed the PhD") are published from the records — straight away or as drafts for one-click publishing (your choice).
- **Privacy**: scholars appear only if *they* agree (toggle in their own record); you can still hide anyone; only name, programme, topic and years are shown. The public site reads separate public copies that never contain private fields.

## What Phase 4 adds (Concepts & Seminars)
- **Concept route per project** (Projects → Concepts): you define concepts with prerequisites (cycles are refused), linked papers and expected outputs. Shown as a layered map coloured by mastery.
- **Concept notes**: scholars claim a concept (only once its prerequisites are at least "Explained"), write definition / explanation / example / misconceptions / sources, and submit. You accept (→ Explained), ask for revision, or mark Applied. Notes stay private until you open the group for that project.
- **Mastery ladder**: Heard of → Explained → Applied → Taught. "Taught" is set automatically when a concept talk is completed and the speaker was present.
- **Seminars** (/seminars, each session has its own link): journal club, batch digest, concept talk, progress talk, prototype demo, paper presentation. Rota generator for fair rotation.
- Speakers upload slides (PDF, private). Missing slides are flagged. Spot-check papers are picked from the speaker's accepted reading cards.
- **Running a session**: attendance, questions asked, action items (each becomes a task with an owner and due date), minutes, status.
- **Scoring**: rubric 1–5 (clarity, depth, critical thinking, Q&A). Supervisor/mentor scores are named; peer scoring is optional per session, anonymous, and only for scholars marked present.
- **Scholar record → Seminars & concepts** tab: talks, attendance %, score trend chart, mastery counts, tasks. Dashboards show upcoming seminars and open tasks.

## What Phase 5 adds (Prototypes & Outputs)
- **Outputs register** (/outputs, each output has its own link): publications, patents, products, software, datasets, thesis chapters. Each kind has its own status pipeline (e.g. Idea → Drafting → Internal review → Submitted → Under review → Revision → Accepted → Published).
- Scholars register their own outputs and move them through the early steps. **Submission, acceptance, filing, grant, release and "final" are confirmed by the supervisor only**; once confirmed the record locks for everyone else (official record). Every move is kept in a history with date and note.
- Files (manuscript, acceptance letter, filing receipt, certificate) are attached as private PDFs/images; append-only.
- **Website, automatically**: when you tick "Show on the website", an accepted/published paper or a published/granted patent appears on the public Publications page by itself, and a News item is created when it first gets there (published at once or as a draft, per your website setting). Products, software and datasets are announced in News when released.
- Mistaken entries can be deleted by the supervisor only (fresh sign-in, never public, no history); anything else is archived, not deleted.
- **Prototype lab** (Project → Prototypes, each prototype has its own link): your stage gates (default Requirements → Design → Build → Test → Demo, editable), each submitted with evidence and approved or sent back by you or a mentor; TRL 1–9 set by you/mentor; bill of materials with costs; permanent logbook (hours, photos/PDFs, back-dating up to 7 days); demo-video and code links; link to a product/software output.
- **Review queue → Outputs & stage gates** tab; **scholar record → Outputs & prototypes** tab; dashboard outputs summary; pipeline funnel chart per kind.

## What v1.1 adds: start without a card
- **File storage is a per-lab choice.** `FILE_STORAGE=cloudinary` keeps uploaded PDFs and images on the lab's own **Cloudinary free account** (no card), so the lab's Firebase can stay on the free Spark plan; authenticator 2FA works there too. `FILE_STORAGE=firebase` keeps them in Firebase Storage (Blaze plan, region of your choice).
- Cloudinary is used strictly: every upload needs a **server signature for one exact path** (no open upload preset), every file is stored as **authenticated (private)**, downloads use **links that expire**, and the browser may only talk to this lab's own Cloudinary account (CSP).
- Evidence bundles over 9 MB are delivered in numbered parts on Cloudinary (10 MB per-file limit on the free plan).
- Settings → System → **File storage**: shows which is in use, **Test now** (real upload, signed read, delete), and **Copy all files to Firebase Storage** for moving later. Setup and *Apply rules & indexes* include the storage test.

## What Phase 7 adds (reports & polish) — v1.0
- **Scholar progress report** (scholar record → *Progress report*; also open to the scholar for themselves and to their mentor): any period; degree progress and milestones completed/overdue/next, presence and leave, reading cards, concept notes and mastery, talks with scores and seminar attendance, outputs and their movement, tasks; optional remarks; signature lines; print or save as PDF.
- **Lab report** (supervisor menu → *Lab report*): group size by programme, milestones completed/overdue/due soon, reading, seminars, papers submitted/accepted/published, patents, leave, and a one-line-per-scholar table linking to each full report.
- **Reset 2FA** for a mentor who lost their phone (Accounts; needs your password and code).
- **Releases are gated by the automatic checks**: the Control Centre only releases a version to other labs after its CI run on GitHub passed.
- Friendly error and "page not found" pages.
- A permanent automated check that every API route signs the caller in (or checks its secret), validates its input, and that no browser code writes to the database or injects HTML.
- DEPLOY.md: 15-minute post-launch security check, first-week order, and troubleshooting.

## What Phase 6 adds (My Office — private to the supervisor)
- **Diary, pinned on top**: My Office → Today, and a **“+ Diary”** button in the top bar on every page. Today's classes (from the current semester's usual days/times) appear as one-tap buttons, ticked once recorded; other subjects, Lab, Meeting, Duty and Other are one tap too. Time defaults to the current hour, room and unit carry over, and the last topic taught is shown. Full diary with filters and CSV download.
- **Teaching**: create each semester with the subjects you teach (code, name, programme, theory/lab/tutorial, number of units, optional usual days/times/rooms; copy from an earlier semester). Only the current semester's subjects are offered in the diary; the date is always today (editable for back-filling). Teaching history per semester (sessions, hours, units covered, last taught) and a printable lecture log per subject.
- **Meetings**: date, time, type, chair, attendees, agenda, key points, decisions, minutes (PDF); create duties from a meeting.
- **Duties**: deadline, reminder days (default 7, 2 and 0 days before), grouped as overdue / today / coming up / later / done; shown on My Office and your dashboard; **“Add to calendar”** gives a calendar file so your phone reminds you (no outside service involved).
- **Office orders**: number, date, type, title, issued by, your responsibility/mention, validity, categories, order copy; create duties from an order.
- **Records & achievements**: several categories per record (multi-select), date or period, level, role, organisation, amount, details, link, evidence files, and the CV section to show it under. Filter by any combination of categories, year and level.
- **CV**: profile, education and experience entered once; every other section fills itself from your records plus the lab's accepted/published papers and patents, your scholars (supervision) and your semesters (teaching). Choose sections to show; print or save as PDF any time.
- **Reports**: pick a period (quick presets: April–March, July–June, calendar year, current semester) and categories; a printable report with summary counts, teaching, records by category, orders, duties and meetings. **Evidence bundle**: one PDF with a cover, an index with page numbers, and every attached certificate/order/letter in order, ready for appraisal.
- **Office settings**: your own lists of categories, levels, order types, meeting types, CV sections (rename, reorder, add), reminder days and diary entry length. Nothing is fixed in the software.

**Upgrading an existing lab to v0.7**: after the new version is live, open Settings → System and press “Apply rules & indexes” once (adds the My Office rules and the private office file folder).

## Setting up
See **DEPLOY.md** — a click-by-click guide from zero to a live Control Centre and labs (no commands needed).
The lab's first-time `/setup` page configures sign-in security, installs the database rules and indexes, and creates the supervisor account.

## Platform pieces (added in v0.3)
- **Setup wizard** (`/setup`, one-time, protected by `SETUP_TOKEN`).
- **Licence** check: each lab carries a signed licence key; it checks in with the Control Centre daily. Suspended/expired → read-only; revoked → read-only for a chosen period, then locked. Data is never deleted.
- **Settings → System**: licence status and version, *Apply rules & indexes* after updates, *Export everything* (JSON lines).
- **Control Centre** (`control-centre/`, separate Vercel project and Firebase project): lab register (faculty, institution, joining date, domains), licence issue/renew/suspend/revoke, handover checklist, environment-variable sheet for each lab's site, check-in status and version, alerts, release to all labs, history.

## Development
```bash
cp .env.example .env.local   # fill values
npm run dev
npm run typecheck && npm test   # unit tests
npm run test:rules              # security-rules tests (needs Java; runs the Firebase emulators)
```

## Project layout
- `src/app/(app)/…` — signed-in pages; `src/app/api/…` — server API (all writes happen here)
- `src/lib/server/` — auth guard, audit, Firebase Admin; `src/lib/domain/` — pure logic (tested)
- `firestore.rules`, `storage.rules` — database/file security; `tests/` — unit + rules tests
- `scripts/bootstrap.ts` — one-time setup
