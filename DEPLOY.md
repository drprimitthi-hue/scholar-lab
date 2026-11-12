# From zero to live — step by step

Everything is done in web pages (GitHub, Firebase console, Vercel). No commands are needed.
Time: about 1 hour the first time (Control Centre + your lab), then ~20 minutes per new lab.

**What you will have at the end**

| Piece | Where | Who owns it |
|---|---|---|
| Code (one private repository, branches `main` and `stable`) | GitHub | You |
| Control Centre site (register, licences, releases) | Your Vercel account | You |
| Your lab site | Your Vercel account | You |
| Other labs' sites | Your Vercel account (they never see it) | You host them |
| Each lab's data (records, files, logins) | A Firebase project per lab | That faculty member |
| Control Centre data | Its own Firebase project | You |

---

## Part A — One-time platform setup

### A1. GitHub (5 min)
1. Create a **private** repository, e.g. `scholar-lab`. Put the project into it **either** by asking Claude to push it (easiest) **or** with the free **GitHub Desktop** app (File → Add local repository → the unzipped folder → Publish). The GitHub web page cannot be used: it accepts only 100 files at a time and the project has about 470.
2. Create a second branch called **`stable`** from `main` (repository → Branches → New branch).
3. Turn on two-factor sign-in for your GitHub account.

### A2. Control Centre Firebase project (10 min)
1. console.firebase.google.com → **Add project** → name it e.g. `lab-control-centre`.
2. **Authentication** → Get started → enable **Email/Password**. Then Authentication → **Settings → Upgrade** to "Firebase Authentication with Identity Platform" (needed for authenticator-app 2FA).
3. **Firestore Database** → Create → *Production mode* → location **asia-south1 (Mumbai)**.
4. (Nothing to do for rules: *Production mode* already blocks all browser access, which is exactly what the Control Centre needs.)
5. Project settings → General → **Add app → Web** → copy the config values.
6. Project settings → Service accounts → **Generate new private key** (downloads a JSON file — keep it secret).

### A3. Control Centre on Vercel (10 min)
1. vercel.com → sign up with GitHub → **Add New → Project** → import `scholar-lab`.
2. **Root Directory: `control-centre`**. Framework: Next.js.
3. Environment variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` (from A2.5)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = open the JSON file from A2.6 in a text editor, copy **all** of it, paste (mark **Sensitive**)
   - `SETUP_TOKEN` = any random text of 32+ characters (e.g. from a password manager)
   - `CONTROL_CENTRE_URL` = the address Vercel gives the project, e.g. `https://scholar-lab-control.vercel.app`
4. Deploy. Then open **`<control-centre-address>/setup`** → **Generate keys** → add `LICENCE_PRIVATE_KEY` and `LICENCE_PUBLIC_KEY` to the Vercel environment variables (Sensitive) → Vercel → Deployments → **Redeploy**.
5. Reload `/setup` → enter the SETUP_TOKEN, your email and a strong password → **Create administrator** → sign in → scan the QR code with an authenticator app → sign out and in again with the code.
6. (Later, for releases) GitHub → Settings → Developer settings → **Fine-grained token** with access only to `scholar-lab`, permissions *Contents: Read and write* and *Actions: Read-only* (so a version is released only after its automatic checks pass). Add `GITHUB_TOKEN` and `GITHUB_REPO=<your-github-name>/scholar-lab` to the Control Centre's Vercel variables and redeploy.

---

## Part B — Add a lab (do this first for your own lab)

### B1. Register it in the Control Centre (3 min)
1. **Add lab** → faculty details, lab id (e.g. `munjal-lab`), lab name, date of joining → Add.
2. **Licence & access** → choose expiry (your own lab: tick *No expiry*) → **Issue licence**.
3. **Site settings** → **Generate SETUP_TOKEN and CRON_SECRET** → keep this page open; you'll copy from it.

### B2. Choose where files are kept (decide once per lab)
| | **Cloudinary** (default, no card) | **Firebase Storage** |
|---|---|---|
| Card needed | No: Firebase stays on the free Spark plan | Yes: Firebase Blaze plan |
| Files | Private on Cloudinary (signed uploads, links that expire) | Private in the lab's Firebase, region you choose (Mumbai) |
| Limits | 10 MB per file; a monthly allowance shared by storage and downloads | Pay per use; budget alert |
| Database backups | Monthly *Export all data* (scheduled backups need billing) | Daily scheduled backups |
A lab can move from Cloudinary to Firebase Storage later (Settings → System → *Copy all files to Firebase Storage*), with no change to records.

**If Cloudinary:** create a free account at cloudinary.com (no card) with the Google account that will own the lab's data → Dashboard → **Settings → API Keys** → note *Cloud name*, *API Key* and *API Secret*.

### B3. The lab's Firebase project (10 min)
1. **Add project** (e.g. `munjal-lab`). **Firebase Storage only:** switch to **Blaze** and **set a budget alert**. With Cloudinary, stay on the free **Spark** plan.
2. **Authentication** → Get started (the setup wizard turns on the rest; authenticator 2FA works on the free plan).
3. **Firestore Database** → Create → Production mode → asia-south1.
4. **Firebase Storage only:** **Storage** → Get started → same region.
5. Add a **Web app** → copy config. **Service accounts → Generate new private key**.

### B4. The lab's Vercel project (5 min)
1. Vercel → **Add New → Project** → import the same `scholar-lab` repository → **Root Directory: leave empty**.
2. Environment variables:
   - From Firebase: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (Firebase Storage only), and `FIREBASE_SERVICE_ACCOUNT_JSON` (paste the whole JSON; Sensitive)
   - File storage: `FILE_STORAGE` = `cloudinary` or `firebase`. If Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Sensitive)
   - From the Control Centre's *Site settings*: `LAB_ID`, `LICENCE_KEY`, `LICENCE_PUBLIC_KEY`, `CONTROL_CENTRE_URL`, `SETUP_TOKEN`, `CRON_SECRET` (Sensitive)
3. Deploy. **For every lab except your own:** Settings → Git → **Production Branch = `stable`** (your own lab stays on `main`, so you see changes first).
4. Optional: Settings → Domains → add the lab's own domain.

### B5. Run the setup wizard (2 min)
Open **`<lab-site>/setup`** → paste the SETUP_TOKEN → lab name, institution, the supervisor's name, email and password → **Set up my lab**. Every step should show ✓, including **File storage** (a real upload, signed download and delete). If "Database indexes" shows ✗, it can be retried later from Settings → System; anything else ✗ shows what to fix.
Then sign in → scan the QR code (**also on a second device, as a spare**) → sign out and in with the code → fill **Settings**.

### B6. Handover (other faculty only)
Firebase console of their project → Project settings → **Users and permissions** → add the faculty member as **Owner** → they accept → (Firebase Storage only: they link **their own billing**) → you **remove yourself**. With Cloudinary, the faculty member creates the Cloudinary account themselves and gives you the three values; the API Secret should reach you by a separate channel. Tick each step in the Control Centre's *Details & handover* tab.

### B7. Backups (2 min, each lab)
**Every lab:** download Settings → System → **Export all data → Export everything** once a month and keep it safe.
**Labs on Blaze:** also Google Cloud console → Firestore → **Disaster recovery** → create a **daily backup schedule** with the longest retention the console offers (up to 14 weeks).

---

## Part C — Updates

1. Claude pushes changes to `main` → **your lab** updates automatically → you test.
2. Control Centre → **Releases** → check that *Automatic checks* shows **passed** → **Release to all labs** → every other lab rebuilds from `stable` (a few minutes). The button stays disabled until the checks pass.
3. If the release notes say rules changed: each supervisor clicks **Settings → System → Apply rules & indexes**.
4. Something wrong? Vercel → the lab's project → Deployments → previous one → **Promote to Production** (instant rollback).

## Part D — Licences

- Labs check in daily; renewals, suspensions and revocations take effect within a day.
- Suspended = read-only. Revoked = read-only for the days you choose (they can export everything from Settings → System), then locked. Their data is never deleted.
- The Control Centre's **Labs** page shows who needs attention: expiring licences, missed check-ins, old versions, unfinished handovers.

---

## Part E — The 15-minute check after going live (do it once per lab)

Use a private browser window for the "scholar" steps so you are not signed in as the supervisor.

| # | Do this | You should see |
|---|---|---|
| 1 | Open the lab address | The public website (Home, Research, People…). No private data. |
| 2 | Open `<lab-site>/setup` again | "This lab is already set up." (the wizard cannot be run twice) |
| 3 | Sign in as supervisor | You are asked for the 6-digit authenticator code |
| 4 | Settings → System → **Check now** | Status **ok**, your lab id, licence expiry, last check with the Control Centre today |
| 5 | Accounts → add a test scholar (your second email) | A temporary password is shown once |
| 6 | Private window: sign in as the test scholar | Forced to change the password; then only *their own* menu (no Accounts, no My Office, no Lab report) |
| 7 | As the scholar, type `/office` and `/scholars` in the address bar | "Private to the supervisor" / only their own record |
| 8 | As the scholar: Presence → check in; Leave → apply | Appears instantly on your dashboard |
| 9 | As supervisor: My Office → + Diary → add one entry | Appears under Today |
| 10 | My Office → Records → add a record with a PDF → Reports → **Download evidence bundle** | A PDF with cover, index and your file |
| 11 | Scholar record → Website → leave consent **off** | They do **not** appear on the public People page |
| 12 | Settings → System → Export all data → **Export everything** | A file downloads (keep it as your first backup) |
| 13 | Accounts → **disable** the test scholar | They can no longer save anything (immediately), cannot sign in again, and an already-open page loses access within an hour at most |

If any line differs, stop and tell Claude which number failed.

## Part F — First week (suggested order)

1. **Settings**: programmes, leave types, statuses, timezone, accent colour, logo. **Settings → Templates**: degree milestones per programme.
2. **Lab website → Content**: about, research themes, your bio and links, contact; choose whether automatic news is published at once or kept as drafts.
3. **Accounts**: add scholars (and mentors, who must set up 2FA). Each scholar fills their enrolment record; you generate their milestones.
4. **Projects**: create projects, assign scholars, upload the literature CSV, set the reading budget and release rule.
5. **My Office → Office settings**, then **Teaching → New semester** with this semester's subjects (add usual days and times to get one-tap diary buttons).
6. **My Office → CV**: profile, education, experience. Add past achievements under **Records** over time; the CV and reports fill themselves.
7. On your phone, open the lab address → browser menu → **Add to Home screen** so "+ Diary" is one tap away.

## Part G — If something goes wrong

| Problem | What to do |
|---|---|
| A page shows "Something went wrong" | Reload. If it repeats, note the reference code shown and the page address. Your data is not affected. |
| "Read-only" banner | The licence is expired/suspended or the daily check-in failed. Check Settings → System; contact the Control Centre owner. |
| A scholar forgot their password | Accounts → that person → **Reset password** (gives a new temporary password). |
| A mentor lost their phone (2FA) | Accounts → that person → **Reset 2FA** (you confirm with your password and code); they set it up again at their next sign-in. |
| You lost your own authenticator phone | **Prevent it:** when you first scan the QR code, scan it on a second device too (or save it in a password manager that supports codes). If it happens anyway, ask Claude for the one-time recovery steps; they are done by the project owner in the Google Cloud console and nobody else can do them. |
| A deployment broke something | Vercel → project → Deployments → previous one → **Promote to Production** (instant), then tell Claude. |
