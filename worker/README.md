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

Optional — create a per-order Google Drive folder (JPEG upload is manual):

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-service-account.json
GOOGLE_DRIVE_FOLDER_ID=...
```

Optional:

```bash
APP_ROOT=/path/to/exhibition
WORKER_POLL_SECONDS=60
WORKER_TEMP_DIR=/tmp/exhibition-worker
```

## Behaviour

For each `awaiting_file` item the worker:

1. Builds a print-ready JPEG from the master TIFF
2. Saves it under `LOCAL_OUTPUT_DIR/<order>_<slug>/`
3. Creates one Google Drive folder (if Drive is configured) — **does not upload the JPEG**
4. Marks the item `file_ready` so it is not retried

Upload the JPEG into the Drive folder yourself, then share it with the print lab.

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
