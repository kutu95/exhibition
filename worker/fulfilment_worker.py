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
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from PIL import Image, ImageCms, ImageOps

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


class GoogleDriveClient:
    def __init__(self, config: WorkerConfig):
        credentials = service_account.Credentials.from_service_account_file(
            str(config.google_credentials_path),
            scopes=[DRIVE_SCOPE],
        )
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

    def upload_jpeg(self, path: Path, folder_id: str) -> dict[str, str]:
        media = MediaFileUpload(str(path), mimetype="image/jpeg", resumable=True)
        file_id = ""
        try:
            created = self.service.files().create(
                body={"name": path.name, "parents": [folder_id]},
                media_body=media,
                fields="id,webViewLink,webContentLink",
                supportsAllDrives=True,
            ).execute()
            file_id = str(created["id"])
            self.service.permissions().create(
                fileId=file_id,
                body={"type": "anyone", "role": "reader"},
                fields="id",
                supportsAllDrives=True,
            ).execute()
            metadata = self.service.files().get(
                fileId=file_id,
                fields="id,webViewLink,webContentLink",
                supportsAllDrives=True,
            ).execute()
            return {
                "id": str(metadata["id"]),
                "webViewLink": str(metadata.get("webViewLink") or ""),
                "webContentLink": str(metadata.get("webContentLink") or ""),
                "direct_download_url": f"https://drive.google.com/uc?export=download&id={file_id}",
            }
        except Exception:
            if file_id:
                self.delete_file_quietly(file_id)
            raise

    def delete_file_quietly(self, file_id: str) -> None:
        try:
            self.service.files().delete(fileId=file_id, supportsAllDrives=True).execute()
        except Exception:
            pass


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

        slug = str(item.get("slug") or slugify(str(item.get("master_filename") or "print")))
        filename = f"{order_number(item)}_{slug}_{int(width_mm)}x{int(height_mm)}mm.jpg"
        output = self.config.temp_dir / filename

        with Image.open(master_path) as image:
            converted = self._convert_profile(image, item, destination_profile, imagecms_perceptual_intent(), flags=flags)
            # Preserve source aspect ratio to avoid distortion. Fit the image inside
            # the print area and center on a white canvas when ratios differ.
            fitted = ImageOps.contain(converted, (content_width_px, content_height_px), Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", (content_width_px, content_height_px), (255, 255, 255))
            offset_x = (content_width_px - fitted.width) // 2
            offset_y = (content_height_px - fitted.height) // 2
            canvas.paste(fitted, (offset_x, offset_y))
            converted = canvas
            if border_px > 0:
                converted = ImageOps.expand(converted, border=border_px, fill=(255, 255, 255))
            converted = converted.convert("RGB")
            converted.save(output, "JPEG", quality=90, icc_profile=destination_profile_bytes)
        return output


class FulfilmentWorker:
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.api = ApiClient(config)
        self.drive = None if config.local_output_dir else GoogleDriveClient(config)
        self.images = ImageProcessor(config)
        self.running = True

    def stop(self, *_args: object) -> None:
        self.running = False

    def master_path_for_item(self, item: dict[str, Any]) -> Path:
        master_filename = item.get("master_filename")
        if not master_filename:
            raise RuntimeError(f"No master_filename on queue item {order_number(item)}")
        return self.config.master_files_dir / Path(str(master_filename)).name

    def process_item(self, item: dict[str, Any]) -> None:
        item_ref = order_number(item)
        item_ref_id = item_id(item)
        master_path = self.master_path_for_item(item)
        if not master_path.exists():
            message = f"Master file not found: {master_path}"
            log(f"{item_ref}: {message}")
            self.api.patch_item(item_ref_id, {"fulfilment_notes": message})
            return

        log(f"{item_ref}: generating print file")
        temp_file = self.images.generate_print_file(master_path, item)
        try:
            slug = str(item.get("slug") or slugify(str(item.get("master_filename") or item_ref)))
            if self.config.local_output_dir:
                order_folder = self.config.local_output_dir / f"{item_ref}_{slug}"
                order_folder.mkdir(parents=True, exist_ok=True)
                destination = order_folder / temp_file.name
                shutil.copy2(temp_file, destination)
                self.api.patch_item(
                    item_ref_id,
                    {
                        "fulfilment_status": "file_ready",
                        "cloud_file_url": destination.as_uri(),
                        "cloud_folder_path": str(order_folder),
                    },
                )
                log(f"{item_ref}: saved locally to {destination} and marked file_ready")
            else:
                if self.drive is None:
                    raise RuntimeError("Drive client is not initialized.")
                folder_id = self.drive.create_folder(f"{item_ref}_{slug}")
                metadata = self.drive.upload_jpeg(temp_file, folder_id)
                self.api.patch_item(
                    item_ref_id,
                    {
                        "fulfilment_status": "file_ready",
                        "cloud_file_url": metadata["direct_download_url"],
                        "cloud_folder_path": folder_id,
                    },
                )
                log(f"{item_ref}: uploaded and marked file_ready")
        finally:
            temp_file.unlink(missing_ok=True)

    def run_once(self) -> None:
        items = self.api.queue()
        pending = [item for item in items if item.get("fulfilment_status") == "awaiting_file"]
        if not pending:
            log("No awaiting_file items.")
            return

        for item in pending:
            try:
                self.process_item(item)
            except Exception:
                log(f"{order_number(item)}: processing failed\n{traceback.format_exc()}")

    def run_forever(self) -> None:
        self.api.health()
        if self.config.local_output_dir:
            self.config.local_output_dir.mkdir(parents=True, exist_ok=True)
            log(f"Using local output directory: {self.config.local_output_dir}")
        else:
            if not self.config.google_drive_folder_id:
                raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is required when LOCAL_OUTPUT_DIR is not set.")
            if self.drive is None:
                raise RuntimeError("Drive client is not initialized.")
            self.drive.check_access()
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
