# Oud Notes

A calm, local-first note-taking app. Notes are stored in a SQLite database on your computer.

## Install on macOS

Download `Oud Notes.dmg`, open it, and drag **Oud Notes** into the Applications folder.

The desktop app stores notes at:

```text
~/Library/Application Support/Oud Notes/notes.db
```

The current build is for Apple Silicon Macs and is ad-hoc signed. Because it is
not notarized with an Apple Developer ID, macOS may require the first launch via
**Control-click → Open**.

## Run it

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5050> in your browser.

## Build the macOS installer

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-desktop.txt
./scripts/build_macos.sh
```

The app bundle and installer are written to `dist/Oud Notes.app` and
`dist/Oud Notes.dmg`.

## Features

- Automatic saving
- Search, folders, and tags
- Pinning and Markdown preview
- Markdown export
- Responsive layout and dark mode

The local database is created at `instance/notes.db` and is excluded from Git.

## Test it

```bash
python -m unittest discover -s tests
```
