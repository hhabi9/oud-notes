from __future__ import annotations

from pathlib import Path

import webview

from app import create_app


APP_NAME = "Oud Notes"


def application_support_dir() -> Path:
    return Path.home() / "Library" / "Application Support" / APP_NAME


def create_desktop_app():
    data_dir = application_support_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    return create_app({"DATABASE": str(data_dir / "notes.db")})


def main() -> None:
    webview.settings["ALLOW_DOWNLOADS"] = True
    webview.create_window(
        APP_NAME,
        create_desktop_app(),
        width=1280,
        height=820,
        min_size=(820, 600),
        background_color="#f5f3ed",
        text_select=True,
    )
    webview.start(debug=False)


if __name__ == "__main__":
    main()
