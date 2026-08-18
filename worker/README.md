# Fulfilment Worker

Headless Python worker for print fulfilment.

**Workflow overview:** [docs/image-and-fulfilment-workflow.md](../docs/image-and-fulfilment-workflow.md)

The worker is intentionally separate from the Next.js web process. It can run on
the Ubuntu server with the master TIFF share mounted locally.

## Environment

Required:

```bash
EXHIBITION_API_BASE_URL=https://exhibition.margies.app
EXHIBITION_API_KEY=...
MASTER_FILES_DIR=/mnt/nas/AppData/Exhibition/Masters
PRINT_OUTPUT_PROFILE_PATH=/path/to/AdobeRGB1998.icc
LOCAL_OUTPUT_DIR=/mnt/nas/AppData/Exhibition/print-output
```

Optional — automatically create a per-order folder and upload the TIFFs to a
personal Google Drive account:

```bash
GOOGLE_OAUTH_TOKEN_PATH=/path/to/google-oauth-token.json
GOOGLE_DRIVE_FOLDER_ID=...
```

`GOOGLE_APPLICATION_CREDENTIALS` remains supported for Shared Drives, but a
service account cannot upload into its own My Drive because it has no storage
quota.

Optional:

```bash
APP_ROOT=/path/to/exhibition
WORKER_POLL_SECONDS=60
WORKER_TEMP_DIR=/tmp/exhibition-worker
```

## Behaviour

For each `awaiting_file` item the worker:

1. Builds a print-ready flat 8-bit TIFF from the master (Adobe RGB, ZIP compression, DPI metadata)
2. Saves it under `LOCAL_OUTPUT_DIR/<order>/`
3. Creates one Google Drive folder **per order** (reused for every print in that
   order), uploads the TIFF, and grants unlisted `anyone with the link` reader
   access (if Drive OAuth is configured)
4. Marks the item `file_ready` so it is not retried

The local copy is always retained. If Drive creation or upload fails, the item is
still marked `file_ready` with a note directing you to upload the local copy
manually.

The public file URL is stored in `cloud_file_url` for copying into the Pixel
Perfect order. Anyone possessing that URL can download the print file, although
it is not discoverable through search. Remove the Drive permission or delete the
file when the lab no longer needs access.

## Personal Google Drive OAuth setup

OAuth does not use or store your Google password.

1. In Google Cloud Console, enable **Google Drive API**.
2. Configure the OAuth consent screen. Add your Google account as a test user
   while setting up; publish the app to Production before unattended use so the
   refresh token does not expire after seven days.
3. Create an OAuth client with application type **Desktop app** and download its
   JSON file.
4. On a computer with a browser, install dependencies and authorize once:

```bash
cd /path/to/exhibition
python3 -m venv worker/.venv
worker/.venv/bin/pip install -r worker/requirements.txt
worker/.venv/bin/python worker/authorize_google_drive.py ~/Downloads/client_secret.json
```

5. Copy `worker/google-oauth-token.json` securely to the production server and
   set its permissions and worker environment:

```bash
chmod 600 /path/to/google-oauth-token.json
GOOGLE_OAUTH_TOKEN_PATH=/path/to/google-oauth-token.json
GOOGLE_DRIVE_FOLDER_ID=...
```

The token grants Drive access and must be protected like a password. The worker
refreshes expired access tokens automatically.

## Colour / masters

The worker prepares files for Pixel Perfect in one configured output colour
space, normally Adobe RGB 1998. `PRINT_OUTPUT_PROFILE_PATH` must point at that
ICC profile. The selected paper/media stays as order metadata; paper-specific ICC
profiles are not required for output conversion.

Master TIFFs must contain an embedded source ICC profile. If the master has no
embedded profile, processing stops with a descriptive error rather than guessing.

## Run

```bash
cd /path/to/exhibition
python3 -m venv worker/.venv
worker/.venv/bin/pip install -r worker/requirements.txt
worker/.venv/bin/python worker/fulfilment_worker.py
```

Run it under `systemd` or `pm2` in production.
