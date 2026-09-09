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
- Recovery of pending edits after reopening; export waits for saving
- Search, folders, and tags
- Pinning and Markdown preview
- Full GFM/CommonMark preview with tables, tasks, footnotes, math, Mermaid diagrams, and syntax highlighting
- Markdown export
- Responsive layout and dark mode
- Preferences (gear button or ⌘,): theme, writing font, and note-view zoom
- Six themes: Light, Sepia, Ocean, Dark, Forest, and Midnight; cycle with the sidebar theme button
- Import Markdown/text files or JSON backups; export the full library with metadata

Use ⌘+ / ⌘− to zoom the note view, and ⌘0 to reset it. Preferences are remembered
on this device. Imports add copies without replacing existing notes. JSON backups
preserve text and metadata; linked images and other external files are not embedded.

The local database is created at `instance/notes.db` and is excluded from Git.

## Markdown preview

The preview supports CommonMark and GitHub Flavored Markdown: headings, emphasis,
links, images, blockquotes, nested lists, task lists, tables, horizontal rules,
inline and fenced code, and strikethrough. It also supports footnotes (`[^1]`),
KaTeX math (`$x$` or `$$x$$`), Mermaid diagrams in fenced `mermaid` blocks, and
syntax highlighting in fenced code blocks. Raw HTML is sanitized before display.

## Test it

```bash
npm install
npm test
python -m unittest discover -s tests
```
