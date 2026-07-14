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
$env:MYSQL_HOST = "your-mysql-host"
$env:MYSQL_PORT = "3306"
$env:MYSQL_DATABASE = "your-database-name"
$env:MYSQL_USER = "your-database-user"
$env:MYSQL_PASSWORD = "your-rotated-password"
```

The bridge accepts existing teacher/student emails and PHP bcrypt password hashes from `password_hash()`. Registration is disabled in this mode because account creation remains owned by your existing school system.

If your old PHP app uses `DB_SERVER=localhost`, that usually means "localhost from the web-hosting server", not from your Windows machine. For local testing you need either:

- the real external MySQL hostname from your hosting panel, with your current IP allowlisted for remote MySQL, or
- to run the Node game server on the same host/network as the MySQL database.

The smoke test for live credentials is:

```powershell
npm run mysql:auth:smoke
```

## 6. Wipe Existing Firestore Data

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
