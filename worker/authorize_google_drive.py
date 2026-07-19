from __future__ import annotations

import argparse
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Authorize a personal Google Drive account for the fulfilment worker."
    )
    parser.add_argument("client_secret", type=Path, help="Downloaded OAuth desktop client JSON")
    parser.add_argument(
        "--token",
        type=Path,
        default=Path("worker/google-oauth-token.json"),
        help="Token output path (default: worker/google-oauth-token.json)",
    )
    args = parser.parse_args()

    client_secret = args.client_secret.expanduser().resolve()
    token_path = args.token.expanduser().resolve()
    if not client_secret.is_file():
        parser.error(f"OAuth client JSON not found: {client_secret}")

    flow = InstalledAppFlow.from_client_secrets_file(str(client_secret), [DRIVE_SCOPE])
    credentials = flow.run_local_server(port=0, prompt="consent", access_type="offline")

    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(credentials.to_json())
    token_path.chmod(0o600)

    print(f"OAuth token saved to {token_path}")
    print(f"Set GOOGLE_OAUTH_TOKEN_PATH={token_path}")
    print("Treat this token like a password; do not commit or share it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
