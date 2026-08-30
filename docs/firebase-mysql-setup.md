# Firebase + Existing MySQL Users Setup

## 1. Rotate The MySQL Password

The database password was pasted into chat, so treat it as exposed. Rotate the MySQL user password in your hosting control panel before putting the game online.

## 2. Enable Firestore

In Firebase Console:

1. Open **Firestore** from the left sidebar.
2. Click **Create database**.
3. Choose **Production mode**.
4. Pick the closest permanent region.
5. Finish creation.

The game server uses the Firebase Admin SDK, so Firestore security rules are not the main protection for game writes. The Node game server remains authoritative.

## 3. Create A Service Account Key

From the screen shown in your screenshot:

1. Open **Settings**.
2. Click **Service accounts**.
3. Keep **Node.js** selected.
4. Click **Generate new private key**.
5. Save the downloaded JSON outside the repo, for example:
   `C:\Users\asher\Secrets\blockcraft-firebase-service-account.json`

Never commit that JSON file.

## 4. Configure The Game Server

For local testing, set PowerShell environment variables before starting the server:

```powershell
$env:STORE = "firebase"
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\asher\Secrets\blockcraft-firebase-service-account.json"
npm run firebase:smoke
npm start
```

For production, prefer secrets/env vars:

```env
STORE=firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

If the browser client is hosted separately on Vercel, set the exact Vercel origin on the Colyseus server too:

```env
CLIENT_ORIGIN=https://your-vercel-client.vercel.app
```

The client uses the Colyseus endpoint automatically on `*.vercel.app`, and can also be pointed at a different backend with `?backend=https://your-colyseus-endpoint`.

## 5. Existing MySQL Users

The repo supports Firebase storage and optional MySQL-backed login. Set `AUTH_BACKEND=mysql` so `/auth/login` validates against:

- `teachers.email` + `teachers.password_hash`
- `students.email` + `students.password_hash`

Recommended game account ids:

- `teacher_<id>`
- `student_<id>`

Those ids become the Firestore document ids under `players/{accountId}`.

Set these env vars to enable the MySQL auth bridge:

```powershell
$env:AUTH_BACKEND = "mysql"
$env:MYSQL_HOST = "liveweave.net"
$env:MYSQL_PORT = "3306"
$env:MYSQL_DATABASE = "your-database-name"
$env:MYSQL_USER = "your-database-user"
$env:MYSQL_PASSWORD = "your-rotated-password"
```

The bridge accepts existing teacher/student emails and PHP bcrypt password hashes from `password_hash()`. Registration is disabled in this mode because account creation remains owned by your existing school system. The game login screen should be treated as "sign in with school account"; it creates only the Firebase game profile/save after MySQL authentication succeeds.

For existing students whose `students.email` is not a school-domain email address, the bridge still accepts their saved email/password and resolves the school from `students.school_id`. If `school_id` is blank, it falls back to the email domain and `schools.domain`.

Teacher/admin logins use the `teachers` table first. The bridge preserves `teachers.role` values such as `teacher` or `admin`, resolves the school from `teachers.school_id`, then falls back to `teachers.domain` and the login email domain.

## 5a. LiveWeave Game Question Bank

The game owns a separate MySQL table named `game_question`. This is intentional:
assessment `questions` remain for formal tests and markbooks, while
`game_question` powers Recall, quests, and other in-game learning moments.

For Blockcraft homework/question gameplay, point the question store at the
LiveWeave database. This is the database used by:

- press-`P` Recall / Question Hall attempts,
- homework progress,
- the tavern Scholar Table / Knowledge Challenge,
- teacher dashboard game-question authoring and analytics.

The server checks these environment variables first:

```powershell
$env:GAME_QUESTION_MYSQL_HOST = "liveweave.net"
$env:GAME_QUESTION_MYSQL_PORT = "3306"
$env:GAME_QUESTION_MYSQL_DATABASE = "your-liveweave-question-database"
$env:GAME_QUESTION_MYSQL_USER = "your-liveweave-question-user"
$env:GAME_QUESTION_MYSQL_PASSWORD = "your-liveweave-question-password"
```

Aliases are also accepted in this order: `LIVEWEAVE_MYSQL_*`,
`QUESTION_MYSQL_*`, then the older shared `MYSQL_*` values. Use the dedicated
`GAME_QUESTION_MYSQL_*` values when the login database and question database are
not exactly the same.

The Node server creates `game_question` on first teacher-tool use when a MySQL
question connection is configured. Rows link back to the existing school model:

- `subjects.id`
- `teachers.id`
- optional `schools.id`

Teacher access is checked through existing `teacher_subjects` and
`class_subject_teachers` relationships. The teacher API lives under:

- `GET /auth/teacher/subjects`
- `GET /auth/teacher/classes?subjectId=...`
- `GET /auth/teacher/game-questions?subjectId=...`
- `POST /auth/teacher/game-questions`
- `POST /auth/teacher/game-questions/:id`

If your old PHP app uses `DB_SERVER=localhost`, that usually means "localhost from the web-hosting server", not from your Windows machine. For local testing you need either:

- the real external MySQL hostname from your hosting panel, with your current IP allowlisted for remote MySQL, or
- to run the Node game server on the same host/network as the MySQL database.

The smoke test for live credentials is:

```powershell
npm run mysql:auth:smoke
```

## 5b. Scholar Table / Knowledge Challenge Content

The tavern Scholar Table uses the LiveWeave game-question connection. It needs:

- Valid `GAME_QUESTION_MYSQL_HOST`, `GAME_QUESTION_MYSQL_PORT`,
  `GAME_QUESTION_MYSQL_DATABASE`, `GAME_QUESTION_MYSQL_USER`, and
  `GAME_QUESTION_MYSQL_PASSWORD`.
- A seeded Knowledge Challenge subject in the `kc_*` tables and atom-linked `game_question` rows.

Check whether the configured LiveWeave database has playable Scholar Table content:

```powershell
npm run mysql:kc:status
```

Check a specific subject:

```powershell
npm run mysql:kc:status -- --subject "English"
npm run mysql:kc:status -- --subject-id 123
```

Seed the pilot content pack into LiveWeave MySQL:

```powershell
npm run mysql:kc:seed
```

Or seed a specific subject/school:

```powershell
npm run mysql:kc:seed -- --subject-id 123 --school-id 3
```

The default pack is `content/knowledge-challenge/sample-pack.json`. Re-running the seed is
idempotent: existing entities, atoms, questions, and confusion pairs are updated in place.
The checked-in default pack is an empty placeholder so removed Computer Science pilot content
cannot be accidentally reseeded.

To soft-delete Computer Science question content from the configured LiveWeave question DB:

```powershell
npm run mysql:questions:delete-cs
$env:CONFIRM_DELETE_COMPUTER_SCIENCE_QUESTIONS = "DELETE_COMPUTER_SCIENCE_QUESTIONS"
npm run mysql:questions:delete-cs -- --force
```

This deactivates matching `game_question`, `kc_entity`, and `kc_atom` rows and closes open
Computer Science homework without deleting historical attempts.

## 6. Reset A Player Game Profile

To reset one player's game progress without deleting their LiveWeave/MySQL
school account, set a long random server-only token:

```env
ADMIN_RESET_TOKEN=replace-with-a-long-random-secret
```

Then call the reset endpoint with either the school email or the game account id:

```powershell
$body = @{ email = "student@example.com" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri "https://your-colyseus-endpoint/auth/admin/reset-player" `
  -Headers @{ "x-admin-reset-token" = "replace-with-a-long-random-secret" } `
  -ContentType "application/json" `
  -Body $body
```

The next login creates a fresh Firebase player profile and runs first-time
onboarding again.

## 7. Wipe Existing Firestore Data

If your Firebase project already has old test collections, run a dry-run first:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\asher\Secrets\blockcraft-firebase-service-account.json"
npm run firebase:wipe:dry
```

To delete only old prototype collections:

```powershell
npm run firebase:wipe:dry -- --only=buildings,characters,decorations,landPlots,players,stores,usernames,users,voxelcraft
```

To actually delete everything in the Firestore database, set the confirmation variable to your Firebase project id:

```powershell
$env:CONFIRM_FIRESTORE_DELETE = "DELETE_your-project-id"
npm run firebase:wipe -- --force
```

This is destructive. Firestore has no simple undo button for a full wipe.
