# Oud Notes

A calm, local-first note-taking app. Notes are stored in a SQLite database on your computer.

## Run it

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5050> in your browser.

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
