# TuneBoxd Team Handoff Guide

This guide gets a teammate from zero to running TuneBoxd on their own laptop, connected to
our shared database, and shipping changes to the live site.

- **Part A (teammates):** clone, connect to the database, run locally, push changes.
- **Part B (Vanohra, the AWS owner):** give each teammate GitHub, AWS and database access.

> ⚠️ **One database for everything.** Local dev, `npm test` and the live Render site all
> use the **same** Amazon RDS MySQL database (`music_review_app`, `us-east-1`). Anything you
> create or delete locally shows up on the live site. Don't run destructive SQL
> (`DROP`, `TRUNCATE`, `DELETE` without `WHERE`) and don't make demo-looking junk accounts.

---

## Part A: For teammates

### A1. What to install

| Tool | Version | Link |
| ---- | ------- | ---- |
| Git | any recent | <https://git-scm.com/downloads> |
| Node.js | **20.12 or newer** (22 LTS recommended) | <https://nodejs.org> |
| MySQL Workbench | 8.x | <https://dev.mysql.com/downloads/workbench/> |
| A code editor | e.g. VS Code | <https://code.visualstudio.com> |

Check Node and Git:

```bash
node -v
```

```bash
git --version
```

### A2. What you need from Vanohra first

You can't connect to the database until all of these are done (Part B covers how):

1. You've accepted the **GitHub collaborator invite** to `Vanohra/TuneBoxd`.
2. You have an **AWS IAM user** sign-in (console URL, username, temporary password).
3. You've sent Vanohra your **public IP address** and they've added it to the RDS firewall.
   Find yours at <https://checkip.amazonaws.com> (just the number, e.g. `203.0.113.45`).
4. You have your **database username and password** (your own MySQL login, *not* your AWS
   login).
5. You have the **RDS endpoint** (the `DB_HOST`), which looks like
   `xxxx.xxxxxxxx.us-east-1.rds.amazonaws.com`. You can also read it yourself in the AWS
   console: **RDS → Databases → (our instance) → Connectivity & security → Endpoint**.

> Your IAM user is for the AWS **website** (looking at the RDS instance). Your MySQL user is
> what the **app and Workbench** log in with. They're two different logins.

### A3. Clone the repo

```bash
git clone https://github.com/Vanohra/TuneBoxd.git
```

```bash
cd TuneBoxd
```

> **Tip (Windows):** don't clone into a OneDrive-synced folder if you can avoid it.
> OneDrive syncing `node_modules` is slow and can lock files. `C:\dev\TuneBoxd` is fine.

### A4. Create your `.env` file

The app reads database credentials from a file called `.env` in the **repo root**. It is
gitignored, so it never gets committed. Copy the example:

macOS / Linux / Git Bash:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and fill it in with **your** values:

```ini
DB_HOST=xxxx.xxxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=music_review_app
DB_SSL=true

SESSION_SECRET=any-long-random-string-for-local-dev
```

- `DB_HOST` is the bare hostname: no `https://`, no `:3306` on the end.
- `DB_SSL=true` encrypts the connection. If your DB user was created with `REQUIRE SSL`
  this is mandatory.
- **Never** commit `.env`, paste it in Discord/Slack, or put it in a screenshot.

### A5. Install and run

From the repo root:

```bash
npm run setup
```

```bash
npm run dev
```

`npm run setup` installs backend and frontend dependencies (only needed the first time and
whenever `package.json` changes). `npm run dev` starts both servers in one terminal:

| What | URL |
| ---- | --- |
| Website (React + Vite) | <http://localhost:5173> ← open this one |
| API (Express) | <http://localhost:4000> (health check: `/api/health`) |

Watch the terminal for one of these lines:

- ✅ `Database connection successful.` You're connected. Open <http://localhost:5173>.
- ❌ `Unable to connect to database (ETIMEDOUT) ...` Your IP isn't allowed in the RDS
  firewall (or it changed). See [Troubleshooting](#a8-troubleshooting).
- ❌ `Unable to connect to database (ER_ACCESS_DENIED_ERROR) ...` Wrong `DB_USER` /
  `DB_PASSWORD`, or `DB_SSL` isn't `true` for an SSL-only user.

Press **Ctrl+C** to stop both servers. Code changes reload automatically (Vite hot-reloads the
frontend; the backend restarts with `node --watch`).

Other root commands:

| Command | What it does |
| ------- | ------------ |
| `npm test` | Unit + end-to-end API tests against the real RDS DB and MusicBrainz (~1 min) |
| `npm run migrate` | Applies `database/migrations/*.sql`. **Coordinate with the team first:** it changes the shared/live DB |
| `npm run build` | Production build of the frontend into `frontend/dist` |

### A6. Connect MySQL Workbench

1. Open MySQL Workbench and click the **⊕** next to **MySQL Connections**.
2. Fill in:

   | Field | Value |
   | ----- | ----- |
   | Connection Name | `TuneBoxd RDS` |
   | Connection Method | Standard (TCP/IP) |
   | Hostname | the RDS endpoint (same as `DB_HOST`) |
   | Port | `3306` |
   | Username | your DB username |
   | Password | click **Store in Vault…** (Windows) / **Store in Keychain…** (Mac) and enter it |
   | Default Schema | `music_review_app` |

3. **SSL tab:** set **Use SSL** to **Require** (or leave **If available**).
4. Click **Test Connection**. You should see "Successfully made the MySQL connection".
   Then **OK**, and double-click the new tile to open it.
5. In the left **Schemas** panel you'll see `music_review_app` and its tables (`users`,
   `reviews`, `diary_entries`, ...). [database/verify_sprint3.sql](../database/verify_sprint3.sql)
   has read-only queries you can run to check saved data.

If Test Connection hangs and then fails with "Can't connect to MySQL server ... (10060)",
that's the firewall: your IP isn't allowed. Same fix as `ETIMEDOUT` below.

### A7. Making changes and getting them on the live site

The live site runs on **Render** and is wired to the `main` branch: **every push (or merged
pull request) to `main` automatically rebuilds and redeploys the site**. Live URL:
**https://tuneboxd.onrender.com** *(Vanohra: confirm/replace with the real URL)*.

Suggested workflow:

```bash
git checkout main
```

```bash
git pull
```

```bash
git checkout -b your-name/short-feature-name
```

Make your changes, test them at <http://localhost:5173>, then:

```bash
git add -A
```

```bash
git commit -m "Describe what you changed"
```

```bash
git push -u origin your-name/short-feature-name
```

Open a Pull Request on GitHub into `main`, have a teammate look at it, then **Merge**.
(Pushing straight to `main` also deploys. It's just riskier, because a broken commit takes
the live site down.)

**What happens after the merge:**

1. Render notices the new commit on `main` and starts a build (`npm run render-build`), then
   starts the server (`npm start`).
2. About **3–5 minutes** later the new version is live at the same URL.
3. Open the live URL and **hard refresh** (Ctrl+Shift+R / Cmd+Shift+R) to see your change.
4. If the change doesn't show up after ~10 minutes, the build probably failed. Ask Vanohra to
   check **Render → tuneboxd → Events / Logs**, and make sure `npm run build` works on your
   machine.

Good to know about the free Render plan:

- The site **sleeps after ~15 min** with no visitors. The first visit afterwards takes
  30–60 seconds. Open it once before a demo.
- Each redeploy or sleep **logs everyone out** (sessions live in memory). Accounts and data
  are safe in MySQL.

### A8. Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| `ETIMEDOUT` in the terminal, or Workbench error 10060 | Your **IP isn't allowed** in the RDS security group. Home IPs change, and school/coffee-shop Wi-Fi has a different IP. Check <https://checkip.amazonaws.com> and send the new IP to Vanohra. |
| `ER_ACCESS_DENIED_ERROR` | Wrong DB username/password, or your user requires SSL and `DB_SSL=true` is missing. |
| `ENOTFOUND` | Typo in `DB_HOST`, or it includes `https://` or `:3306`. Use the bare hostname. |
| `ER_BAD_DB_ERROR` | `DB_NAME` should be `music_review_app`. |
| `'vite' is not recognized` / `Cannot find module` | Run `npm run setup` again. |
| Port 4000 or 5173 already in use | Another `npm run dev` is still running. Close that terminal. |
| `node: bad option: --watch` or syntax errors | Node is too old. Install Node 20.12+ / 22. |
| Live site doesn't show my change | Was it merged into `main`? Wait ~5 min, hard refresh. Otherwise the Render build failed (see A7). |

---

## Part B: For Vanohra (setting teammates up)

Do these once per teammate. You need: GitHub owner access to the repo, the AWS **root or
admin** login, and the RDS **master** DB user in Workbench.

### B1. GitHub access

1. <https://github.com/Vanohra/TuneBoxd> → **Settings → Collaborators → Add people**.
2. Enter their GitHub username and send the invite. They must accept it (email or GitHub
   notifications) before they can push.
3. *(Optional)* **Settings → Branches → Add branch protection rule** for `main` →
   "Require a pull request before merging". This stops accidental direct pushes from
   redeploying the site.

### B2. Create an IAM user for each teammate

IAM users live **inside your AWS account**, so you create them (teammates can't make their
own in your account). This gives them their own AWS console login instead of sharing yours.

1. AWS Console → search **IAM** → **Users** → **Create user**.
2. **User name:** e.g. `tuneboxd-alex`.
3. Check **Provide user access to the AWS Management Console** →
   **I want to create an IAM user** → **Custom password** (or autogenerated) →
   check **Users must create a new password at next sign-in**. Click **Next**.
4. **Permissions:** choose **Attach policies directly** and tick:
   - `AmazonRDSReadOnlyAccess` (lets them see the instance, endpoint and status, but not
     change or delete it)
   - `IAMUserChangePassword` is added automatically because of the reset-on-first-sign-in
     box.

   Don't give them `AdministratorAccess`. They don't need it.
5. **Next → Create user**. On the final page, click **Download .csv** or copy the
   **Console sign-in URL** (`https://<your-account-id>.signin.aws.amazon.com/console`),
   username and password.
6. Send those to the teammate **privately** (DM, not the group chat). Tell them to turn on MFA:
   top-right name → **Security credentials → Assign MFA device**.

> **Optional: let teammates add their own IP.** If you'd rather not do every IP change
> yourself, you can create an inline policy that allows `ec2:DescribeSecurityGroups`,
> `ec2:AuthorizeSecurityGroupIngress` and `ec2:RevokeSecurityGroupIngress` on just the RDS
> security group (`sg-0f17cbc3846d7c761`). Otherwise keep doing it yourself with B3.

### B3. Allow a teammate's IP in the RDS security group (inbound rule)

The RDS security group is the firewall that decides who can reach MySQL on port 3306.

1. Teammate sends you their IP from <https://checkip.amazonaws.com>.
2. AWS Console → **RDS → Databases →** our instance → **Connectivity & security** →
   under **Security**, click the **VPC security group** link (`sg-0f17cbc3846d7c761`).
   You can also go to **EC2 → Security Groups** directly.
3. Select the group → **Inbound rules** tab → **Edit inbound rules → Add rule**:

   | Field | Value |
   | ----- | ----- |
   | Type | **MySQL/Aurora** (fills in TCP 3306) |
   | Source | **Custom** → `203.0.113.45/32` (their IP + `/32` = exactly that one address) |
   | Description | `alex home` (name + place, so you know which rule to remove later) |

4. **Save rules.** It takes effect within seconds, with no restart needed.

Rules of thumb:

- **Never** use `0.0.0.0/0` (the whole internet).
- **Don't remove** the existing **Render** rules (`74.220.49.0/24`, `74.220.57.0/24`, the
  live site's outbound ranges) or your own IP rule.
- When someone's IP changes, **edit** their old rule (or delete it and add a new one) so stale
  IPs don't pile up.
- Also make sure **RDS → Connectivity & security → Publicly accessible = Yes** (it already is,
  or nobody could connect from home).

### B4. Create a MySQL user for each teammate (recommended)

Instead of handing out the master password, give each person their own DB login. Then you
can revoke one person without changing everyone's `.env` (and the Render settings).

Connect in Workbench **as the master user**, open a query tab and run (replace the name and
password):

```sql
CREATE USER 'alex'@'%' IDENTIFIED BY 'a-long-random-password' REQUIRE SSL;

-- Read/write the app's data
GRANT SELECT, INSERT, UPDATE, DELETE ON music_review_app.* TO 'alex'@'%';

-- Only for teammates who will run migrations / change the schema:
-- GRANT CREATE, ALTER, INDEX, DROP, REFERENCES ON music_review_app.* TO 'alex'@'%';
```

Send them the username and password privately. They put them in their `.env` (`DB_USER`,
`DB_PASSWORD`, plus `DB_SSL=true`) and in Workbench.

Useful later:

```sql
SELECT user, host FROM mysql.user;                       -- list DB users
ALTER USER 'alex'@'%' IDENTIFIED BY 'new-password';     -- reset a password
DROP USER 'alex'@'%';                                   -- remove access
```

`@'%'` means "from any IP", but the security group (B3) still decides which IPs can reach
the database at all, so both checks apply.

### B5. Things to tell them

- The RDS endpoint (`DB_HOST`), their DB username/password, and the console sign-in URL.
- The live Render URL.
- "Local dev uses the same DB as the live site, so be careful" (see the warning at the top).
- To message you when their IP changes.

### B6. Offboarding checklist (end of semester)

1. **IAM → Users →** delete their user.
2. **Security group →** delete their inbound rule.
3. **Workbench →** `DROP USER 'name'@'%';`
4. **GitHub →** remove them as a collaborator (optional).
