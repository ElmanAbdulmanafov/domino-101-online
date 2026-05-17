# Firebase Firestore Setup

Server tarixcesi Firestore-a yazir. Telefon/APK Firebase-e birbasa qosulmur; yalniz Node server yazir.

## Local test

Service account JSON faylini repo-ya kocurtme. PowerShell-de path ver:

```powershell
cd "C:\Users\elman\Documents\New project\domino-101"
$env:FIREBASE_SERVICE_ACCOUNT_PATH = "C:\Users\elman\Downloads\domino-a6bfb-firebase-adminsdk-fbsvc-2731afcb87.json"
node server.mjs
```

Server logunda bunu gormelisen:

```text
Firebase enabled: domino-a6bfb
```

Firestore collections:

```text
rooms/{roomCode}
rooms/{roomCode}/events/{eventId}
matches/{matchId}
```

## Render env

Render Dashboard > Service > Environment bolmesinde yeni env var yarat:

```text
FIREBASE_SERVICE_ACCOUNT
```

Value kimi service account JSON-un butun mezmununu paste et. JSON GitHub-a yuklenmemelidir.

Alternativ olaraq base64:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\elman\Downloads\domino-a6bfb-firebase-adminsdk-fbsvc-2731afcb87.json"))
```

Render env key:

```text
FIREBASE_SERVICE_ACCOUNT_BASE64
```

Value kimi base64 neticesini paste et.

## Fallback

Firebase env yoxdursa server lokal JSON fallback istifade edir:

```text
data/game-history.json
```
