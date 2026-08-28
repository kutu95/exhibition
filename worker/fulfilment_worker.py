from __future__ import annotations

import io
import os
import re
import signal
import shutil
import sys
import tempfile
import time
import traceback
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials as UserCredentials
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from PIL import Image, ImageCms, ImageOps

# Masters are trusted local files and often exceed Pillow's default bomb limit.
Image.MAX_IMAGE_PIXELS = None

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"


def log(message: str) -> None:
    print(f"[{datetime.now().isoformat(timespec='seconds')}] {message}", flush=True)


def env_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def slugify(value: str) -> str:
    stem = Path(value).stem
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", stem).strip("-").lower()
    return slug or "untitled"


def order_number(item: dict[str, Any]) -> str:
    return str(item.get("order_number") or item.get("order_id") or item.get("order_item_id") or "order")


def item_id(item: dict[str, Any]) -> str:
    return str(item.get("order_item_id") or item.get("id"))


def item_slug(item: dict[str, Any]) -> str:
    return str(item.get("slug") or slugify(str(item.get("master_filename") or order_number(item))))


def print_folder_name(item: dict[str, Any]) -> str:
    """One folder per photograph in an order; every size ordered of it goes inside."""
    return f"{order_number(item)}_{item_slug(item)}"


def imagecms_perceptual_intent() -> int:
    intent = getattr(ImageCms, "Intent", None)
    return int(getattr(intent, "PERCEPTUAL", 0))


def imagecms_blackpoint_flag() -> int:
    flags = getattr(ImageCms, "Flags", None)
    if flags is not None and hasattr(flags, "BLACKPOINTCOMPENSATION"):
        return int(getattr(flags, "BLACKPOINTCOMPENSATION"))
    legacy_flags = getattr(ImageCms, "FLAGS", {})
    return int(legacy_flags.get("BLACKPOINTCOMPENSATION", 0))


@dataclass(frozen=True)
class WorkerConfig:
    api_base_url: str
    api_key: str
    master_files_dir: Path
    google_credentials_path: Path
    google_oauth_token_path: Path
    google_drive_folder_id: str
    print_output_profile_path: Path
    local_output_dir: Path | None
    poll_seconds: int
    temp_dir: Path

    @classmethod
    def from_env(cls) -> "WorkerConfig":
        local_output_dir_raw = os.environ.get("LOCAL_OUTPUT_DIR", "").strip()
        local_output_dir = Path(local_output_dir_raw).expanduser().resolve() if local_output_dir_raw else None
        return cls(
            api_base_url=env_required("EXHIBITION_API_BASE_URL").rstrip("/"),
            api_key=os.environ.get("EXHIBITION_API_KEY", "").strip()
            or os.environ.get("FULFILMENT_API_KEY", "").strip()
            or env_required("API_KEY"),
            master_files_dir=Path(env_required("MASTER_FILES_DIR")),
            google_credentials_path=Path(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip() or "."),
            google_oauth_token_path=Path(os.environ.get("GOOGLE_OAUTH_TOKEN_PATH", "").strip() or "."),
            google_drive_folder_id=os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "").strip(),
            print_output_profile_path=Path(env_required("PRINT_OUTPUT_PROFILE_PATH")),
            local_output_dir=local_output_dir,
            poll_seconds=int(os.environ.get("WORKER_POLL_SECONDS", "60")),
            temp_dir=Path(os.environ.get("WORKER_TEMP_DIR", tempfile.gettempdir())) / "exhibition-worker",
        )


class ApiClient:
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.session = requests.Session()

    def _url(self, path: str) -> str:
        return f"{self.config.api_base_url}/{path.lstrip('/')}"

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
        }

    def _raise_for_status(self, response: requests.Response) -> None:
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            body = response.text.strip()
            if len(body) > 1000:
                body = body[:1000] + "..."
            raise requests.HTTPError(
                f"{response.status_code} {response.reason} for {response.url}\n{body}",
                response=response,
            ) from exc

    def health(self) -> None:
        response = self.session.get(self._url("/api/fulfilment/health"), timeout=10)
        self._raise_for_status(response)

    def queue(self) -> list[dict[str, Any]]:
        response = self.session.get(
            self._url("/api/fulfilment/queue"),
            headers=self._headers(),
            timeout=30,
        )
        self._raise_for_status(response)
        payload = response.json()
        if isinstance(payload, list):
            return payload
        return list(payload.get("items") or [])

    def patch_item(self, order_item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = self.session.patch(
            self._url(f"/api/fulfilment/items/{order_item_id}"),
            headers={**self._headers(), "Content-Type": "application/json"},
            json=payload,
            timeout=60,
        )
        self._raise_for_status(response)
        return response.json()


def looks_like_drive_id(value: str) -> bool:
    # Drive file/folder IDs are opaque tokens without path separators.
    return bool(value) and "/" not in value and not value.startswith("file:")


class GoogleDriveClient:
    def __init__(self, config: WorkerConfig):
        if config.google_oauth_token_path.is_file():
            credentials = UserCredentials.from_authorized_user_file(
                str(config.google_oauth_token_path),
                scopes=[DRIVE_SCOPE],
            )
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(GoogleAuthRequest())
                config.google_oauth_token_path.write_text(credentials.to_json())
            self.auth_type = "personal OAuth"
        else:
            credentials = service_account.Credentials.from_service_account_file(
                str(config.google_credentials_path),
                scopes=[DRIVE_SCOPE],
            )
            self.auth_type = "service account"
        self.folder_id = config.google_drive_folder_id
        self.service = build("drive", "v3", credentials=credentials, cache_discovery=False)

    def check_access(self) -> None:
        self.service.files().list(
            q=f"'{self.folder_id}' in parents and trashed=false",
            pageSize=1,
            fields="files(id,name)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()

    def find_folder(self, name: str) -> str:
        escaped = name.replace("\\", "\\\\").replace("'", "\\'")
        result = self.service.files().list(
            q=(
                f"'{self.folder_id}' in parents and name = '{escaped}' "
                "and mimeType = 'application/vnd.google-apps.folder' and trashed=false"
            ),
            pageSize=1,
            fields="files(id,name)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        files = result.get("files") or []
        if not files:
            return ""
        return str(files[0]["id"])

    def create_folder(self, name: str) -> str:
        created = self.service.files().create(
            body={
                "name": name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [self.folder_id],
            },
            fields="id",
            supportsAllDrives=True,
        ).execute()
        return str(created["id"])

    def share_anyone_reader(self, file_id: str) -> None:
        try:
            self.service.permissions().create(
                fileId=file_id,
                body={
                    "type": "anyone",
                    "role": "reader",
                    "allowFileDiscovery": False,
                },
                fields="id",
                supportsAllDrives=True,
            ).execute()
        except HttpError as exc:
            status = int(getattr(exc.resp, "status", 0) or 0)
            if status in {400, 403, 409}:
                return
            raise

    def ensure_print_folder(self, name: str) -> str:
        folder_id = self.find_folder(name)
        if not folder_id:
            folder_id = self.create_folder(name)
        self.share_anyone_reader(folder_id)
        return folder_id

    def upload_file(self, folder_id: str, file_path: Path) -> tuple[str, str]:
        media = MediaFileUpload(str(file_path), mimetype="image/tiff", resumable=True)
        created = self.service.files().create(
            body={
                "name": file_path.name,
                "parents": [folder_id],
            },
            media_body=media,
            fields="id,webViewLink",
            supportsAllDrives=True,
        ).execute()
        file_id = str(created["id"])
        self.share_anyone_reader(file_id)
        public_url = str(created.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view")
        return file_id, public_url


class ImageProcessor:
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.config.temp_dir.mkdir(parents=True, exist_ok=True)

    def _profile_from_path(self, profile_path: Path, label: str, item: dict[str, Any]) -> tuple[ImageCms.ImageCmsProfile, bytes]:
        try:
            with profile_path.open("rb") as handle:
                data = handle.read()
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"{label} ICC profile file is missing for {order_number(item)} "
                f"({item.get('slug') or item.get('title') or 'unknown product'}). "
                f"Expected file: {profile_path}"
            ) from exc
        except OSError as exc:
            raise RuntimeError(
                f"{label} ICC profile could not be read for {order_number(item)}. "
                f"Path: {profile_path}. Error: {exc}"
            ) from exc

        try:
            return ImageCms.ImageCmsProfile(str(profile_path)), data
        except Exception as exc:
            raise RuntimeError(
                f"{label} ICC profile is not valid for {order_number(item)}. "
                f"Path: {profile_path}. Re-upload the correct profile in admin."
            ) from exc

    def _source_profile(self, image: Image.Image, item: dict[str, Any]) -> ImageCms.ImageCmsProfile:
        embedded = image.info.get("icc_profile")
        if embedded:
            return ImageCms.ImageCmsProfile(io.BytesIO(embedded))

        raise RuntimeError(
            f"Missing source ICC profile for {order_number(item)} "
            f"({item.get('slug') or item.get('title') or 'unknown product'}). "
            "The master TIFF must have an embedded ICC profile before it can be prepared for Pixel Perfect."
        )

    def _output_profile(self, item: dict[str, Any]) -> tuple[ImageCms.ImageCmsProfile, bytes]:
        return self._profile_from_path(self.config.print_output_profile_path, "Pixel Perfect output", item)

    def _flatten_alpha(self, image: Image.Image) -> Image.Image:
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            rgba = image.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            background.alpha_composite(rgba)
            return background.convert("RGB")
        return image

    def _convert_profile(
        self,
        image: Image.Image,
        item: dict[str, Any],
        dest_profile: ImageCms.ImageCmsProfile,
        intent: int,
        flags: int = 0,
    ) -> Image.Image:
        source_profile = self._source_profile(image, item)
        working = self._flatten_alpha(image)
        if working.mode not in ("RGB", "CMYK", "LAB"):
            working = working.convert("RGB")
        transform = ImageCms.buildTransformFromOpenProfiles(
            source_profile,
            dest_profile,
            working.mode,
            "RGB",
            renderingIntent=intent,
            flags=flags,
        )
        return ImageCms.applyTransform(working, transform).convert("RGB")

    def generate_print_file(self, master_path: Path, item: dict[str, Any]) -> Path:
        width_mm = float(item.get("width_mm") or 0)
        height_mm = float(item.get("height_mm") or 0)
        border_mm = float(item.get("border_mm") or 0)
        print_dpi = int(item.get("print_dpi") or 300)
        if width_mm <= 0 or height_mm <= 0:
            raise RuntimeError(f"Invalid print dimensions for {order_number(item)}: {width_mm} x {height_mm} mm")
        if print_dpi <= 0:
            raise RuntimeError(f"Invalid print DPI for {order_number(item)}: {print_dpi}")

        content_width_px = round(width_mm / 25.4 * print_dpi)
        content_height_px = round(height_mm / 25.4 * print_dpi)
        border_px = round(border_mm / 25.4 * print_dpi)
        destination_profile, destination_profile_bytes = self._output_profile(item)
        flags = imagecms_blackpoint_flag()

        filename = f"{order_number(item)}_{item_slug(item)}_{int(width_mm)}x{int(height_mm)}mm.tif"
        output = self.config.temp_dir / filename

        with Image.open(master_path) as image:
            converted = self._convert_profile(image, item, destination_profile, imagecms_perceptual_intent(), flags=flags)
            fit_mode = str(item.get("fit_mode") or "cover_crop").strip().lower()
            try:
                crop_offset = float(item.get("crop_offset") or 0)
            except (TypeError, ValueError):
                crop_offset = 0.0
            crop_offset = max(-1.0, min(1.0, crop_offset))

            if fit_mode == "custom_size":
                # Dimensions already match photo aspect; fill without letterboxing.
                fitted = ImageOps.fit(
                    converted,
                    (content_width_px, content_height_px),
                    method=Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5),
                )
                canvas = fitted
            else:
                # Cover the print area, then crop. crop_offset pans the free axis
                # (-1..1); the constrained axis stays centred.
                src_w, src_h = converted.size
                if src_w <= 0 or src_h <= 0:
                    raise RuntimeError(f"Invalid source image size for {order_number(item)}")
                scale = max(content_width_px / src_w, content_height_px / src_h)
                scaled_w = max(1, round(src_w * scale))
                scaled_h = max(1, round(src_h * scale))
                scaled = converted.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

                max_x = max(0, scaled_w - content_width_px)
                max_y = max(0, scaled_h - content_height_px)
                if max_x > 0 and max_y == 0:
                    # Wider than target: horizontal pan
                    left = int(round((max_x / 2) * (1 + crop_offset)))
                    left = max(0, min(max_x, left))
                    top = 0
                elif max_y > 0 and max_x == 0:
                    # Taller than target: vertical pan
                    top = int(round((max_y / 2) * (1 + crop_offset)))
                    top = max(0, min(max_y, top))
                    left = 0
                else:
                    left = max_x // 2
                    top = max_y // 2

                canvas = scaled.crop((left, top, left + content_width_px, top + content_height_px))

            converted = canvas
            if border_px > 0:
                converted = ImageOps.expand(converted, border=border_px, fill=(255, 255, 255))
            # Flat 8-bit RGB TIFF for Pixel Perfect — lossless ZIP, Adobe RGB ICC, print DPI.
            converted = converted.convert("RGB")
            converted.save(
                output,
                "TIFF",
                compression="tiff_adobe_deflate",
                dpi=(print_dpi, print_dpi),
                icc_profile=destination_profile_bytes,
            )
        return output


class FulfilmentWorker:
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.api = ApiClient(config)
        credentials_ok = config.google_oauth_token_path.is_file() or config.google_credentials_path.is_file()
        drive_configured = bool(config.google_drive_folder_id) and credentials_ok
        self.drive = GoogleDriveClient(config) if drive_configured else None
        self.images = ImageProcessor(config)
        self.running = True
        self.print_drive_folders: dict[str, str] = {}

    def stop(self, *_args: object) -> None:
        self.running = False

    def master_path_for_item(self, item: dict[str, Any]) -> Path:
        master_filename = item.get("master_filename")
        if not master_filename:
            raise RuntimeError(f"No master_filename on queue item {order_number(item)}")
        return self.config.master_files_dir / Path(str(master_filename)).name

    def sibling_drive_folder_id(self, item: dict[str, Any], queue_items: list[dict[str, Any]]) -> str:
        folder_name = print_folder_name(item)
        cached = self.print_drive_folders.get(folder_name, "").strip()
        if looks_like_drive_id(cached):
            return cached

        own = str(item.get("cloud_folder_path") or "").strip()
        if looks_like_drive_id(own):
            return own

        for other in queue_items:
            if print_folder_name(other) != folder_name:
                continue
            folder = str(other.get("cloud_folder_path") or "").strip()
            if looks_like_drive_id(folder):
                return folder
        return ""

    def process_item(self, item: dict[str, Any], queue_items: list[dict[str, Any]]) -> None:
        item_ref = order_number(item)
        item_ref_id = item_id(item)
        master_path = self.master_path_for_item(item)
        if not master_path.exists():
            message = f"Master file not found: {master_path}"
            log(f"{item_ref}: {message}")
            self.api.patch_item(item_ref_id, {"fulfilment_notes": message})
            return

        if not self.config.local_output_dir:
            raise RuntimeError(
                "LOCAL_OUTPUT_DIR is required. Print TIFFs are saved locally; "
                "upload to Google Drive is manual."
            )

        log(f"{item_ref}: generating print file")
        temp_file = self.images.generate_print_file(master_path, item)
        try:
            folder_name = print_folder_name(item)
            photo_folder = self.config.local_output_dir / folder_name
            photo_folder.mkdir(parents=True, exist_ok=True)
            destination = photo_folder / temp_file.name
            shutil.copy2(temp_file, destination)

            drive_folder_id = self.sibling_drive_folder_id(item, queue_items)

            if self.drive is not None and not drive_folder_id:
                try:
                    drive_folder_id = self.drive.ensure_print_folder(folder_name)
                    log(f"{item_ref}: using Drive folder {folder_name} ({drive_folder_id})")
                except Exception as exc:
                    log(f"{item_ref}: Drive folder creation failed ({exc}); continuing with local file only")
            elif self.drive is not None and drive_folder_id:
                try:
                    self.drive.share_anyone_reader(drive_folder_id)
                except Exception as exc:
                    log(f"{item_ref}: Drive folder share failed ({exc}); continuing")
                log(f"{item_ref}: reusing Drive folder {folder_name} ({drive_folder_id})")

            if looks_like_drive_id(drive_folder_id):
                self.print_drive_folders[folder_name] = drive_folder_id
                item["cloud_folder_path"] = drive_folder_id

            cloud_file_url = destination.as_uri()
            uploaded_to_drive = False
            if self.drive is not None and drive_folder_id:
                try:
                    _drive_file_id, cloud_file_url = self.drive.upload_file(drive_folder_id, destination)
                    uploaded_to_drive = True
                    log(f"{item_ref}: uploaded TIFF to Drive folder {folder_name} and enabled anyone-with-link access")
                except Exception as exc:
                    log(f"{item_ref}: Drive upload failed ({exc}); TIFF remains available locally")

            self.api.patch_item(
                item_ref_id,
                {
                    "fulfilment_status": "file_ready",
                    "cloud_file_url": cloud_file_url,
                    "cloud_folder_path": drive_folder_id or str(photo_folder),
                    "fulfilment_notes": (
                        "Print TIFF saved locally and uploaded to the photograph's Google Drive folder with anyone-with-link download access."
                        if uploaded_to_drive
                        else "Print TIFF saved locally. Drive upload was unavailable; "
                        "upload it manually before sharing with the print lab."
                    ),
                },
            )
            log(
                f"{item_ref}: saved locally to {destination}"
                + (f" (Drive folder {drive_folder_id})" if drive_folder_id else "")
                + " and marked file_ready"
            )
        finally:
            temp_file.unlink(missing_ok=True)

    def run_once(self) -> None:
        self.print_drive_folders = {}
        items = self.api.queue()
        pending = [item for item in items if item.get("fulfilment_status") == "awaiting_file"]
        if not pending:
            log("No awaiting_file items.")
            return

        for item in pending:
            try:
                self.process_item(item, items)
            except Exception:
                log(f"{order_number(item)}: processing failed\n{traceback.format_exc()}")

    def run_forever(self) -> None:
        self.api.health()
        if not self.config.local_output_dir:
            raise RuntimeError(
                "LOCAL_OUTPUT_DIR is required. Print TIFFs are saved locally; "
                "upload to Google Drive is manual."
            )
        self.config.local_output_dir.mkdir(parents=True, exist_ok=True)
        log(f"Using local output directory: {self.config.local_output_dir}")
        if self.drive is not None:
            self.drive.check_access()
            log(f"Drive folder creation and TIFF upload enabled ({self.drive.auth_type}).")
        else:
            log("Drive not configured; local output only.")
        log("Fulfilment worker started.")
        while self.running:
            self.run_once()
            for _ in range(self.config.poll_seconds):
                if not self.running:
                    break
                time.sleep(1)
        log("Fulfilment worker stopped.")


def main() -> int:
    config = WorkerConfig.from_env()
    worker = FulfilmentWorker(config)
    signal.signal(signal.SIGINT, worker.stop)
    signal.signal(signal.SIGTERM, worker.stop)
    worker.run_forever()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        log(traceback.format_exc())
        raise SystemExit(1)
