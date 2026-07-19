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
```

For Google Drive uploads (default mode), also set:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-service-account.json
GOOGLE_DRIVE_FOLDER_ID=...
```

For local-output mode (no Google Drive), set:

```bash
LOCAL_OUTPUT_DIR=/absolute/path/to/print-output
```

Optional:

```bash
APP_ROOT=/path/to/exhibition
WORKER_POLL_SECONDS=60
WORKER_TEMP_DIR=/tmp/exhibition-worker
```

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
