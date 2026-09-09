from __future__ import annotations

import re
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path

from flask import Flask, Response, abort, g, jsonify, render_template, request


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def create_app(test_config: dict | None = None) -> Flask:
    resource_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder=str(resource_root / "static"),
        template_folder=str(resource_root / "templates"),
    )
    app.config.from_mapping(DATABASE=str(Path(app.instance_path) / "notes.db"))

    if test_config:
        app.config.update(test_config)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    def get_db() -> sqlite3.Connection:
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DATABASE"])
            g.db.row_factory = sqlite3.Row
        return g.db

    @app.teardown_appcontext
    def close_db(_error: BaseException | None = None) -> None:
        db = g.pop("db", None)
        if db is not None:
            db.close()

    def init_db() -> None:
        db = get_db()
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '',
                folder TEXT NOT NULL DEFAULT '',
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned DESC);
            """
        )
        db.commit()

    def serialize_note(row: sqlite3.Row) -> dict:
        note = dict(row)
        note["pinned"] = bool(note["pinned"])
        note["tags"] = [tag for tag in note["tags"].split(",") if tag]
        return note

    def find_note(note_id: int) -> sqlite3.Row:
        note = get_db().execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
        if note is None:
            abort(404, description="Note not found")
        return note

    def normalize_tags(value: object) -> str:
        if isinstance(value, str):
            items = value.split(",")
        elif isinstance(value, list):
            items = value
        else:
            return ""
        unique: list[str] = []
        for item in items:
            tag = str(item).strip().replace(",", "")[:40]
            if tag and tag.casefold() not in {existing.casefold() for existing in unique}:
                unique.append(tag)
        return ",".join(unique[:12])

    with app.app_context():
        init_db()

    @app.get("/")
    def index() -> str:
        return render_template("index.html")

    @app.get("/api/notes")
    def list_notes() -> Response:
        search = request.args.get("q", "").strip()
        folder = request.args.get("folder", "").strip()
        clauses: list[str] = []
        values: list[str] = []

        if search:
            clauses.append("(LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?)")
            pattern = f"%{search.casefold()}%"
            values.extend([pattern, pattern, pattern])
        if folder:
            clauses.append("folder = ?")
            values.append(folder)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        rows = get_db().execute(
            f"SELECT * FROM notes {where} ORDER BY pinned DESC, updated_at DESC", values
        ).fetchall()
        return jsonify([serialize_note(row) for row in rows])

    @app.post("/api/notes")
    def create_note() -> tuple[Response, int]:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Expected a JSON object"}), 400
        now = utc_now()
        title = str(payload.get("title", "Untitled note")).strip()[:200] or "Untitled note"
        content = str(payload.get("content", ""))
        folder = str(payload.get("folder", "")).strip()[:80]
        tags = normalize_tags(payload.get("tags", []))
        db = get_db()
        cursor = db.execute(
            """INSERT INTO notes (title, content, tags, folder, pinned, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (title, content, tags, folder, int(bool(payload.get("pinned", False))), now, now),
        )
        db.commit()
        return jsonify(serialize_note(find_note(cursor.lastrowid))), 201

    @app.get("/api/notes/<int:note_id>")
    def get_note(note_id: int) -> Response:
        return jsonify(serialize_note(find_note(note_id)))

    @app.patch("/api/notes/<int:note_id>")
    def update_note(note_id: int) -> Response:
        find_note(note_id)
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Expected a JSON object"}), 400

        updates: dict[str, object] = {}
        if "title" in payload:
            updates["title"] = str(payload["title"]).strip()[:200] or "Untitled note"
        if "content" in payload:
            updates["content"] = str(payload["content"])
        if "folder" in payload:
            updates["folder"] = str(payload["folder"]).strip()[:80]
        if "tags" in payload:
            updates["tags"] = normalize_tags(payload["tags"])
        if "pinned" in payload:
            updates["pinned"] = int(bool(payload["pinned"]))

        if updates:
            updates["updated_at"] = utc_now()
            assignments = ", ".join(f"{column} = ?" for column in updates)
            get_db().execute(
                f"UPDATE notes SET {assignments} WHERE id = ?",
                [*updates.values(), note_id],
            )
            get_db().commit()
        return jsonify(serialize_note(find_note(note_id)))

    @app.delete("/api/notes/<int:note_id>")
    def delete_note(note_id: int) -> tuple[str, int]:
        find_note(note_id)
        get_db().execute("DELETE FROM notes WHERE id = ?", (note_id,))
        get_db().commit()
        return "", 204

    @app.get("/api/notes/<int:note_id>/export")
    def export_note(note_id: int) -> Response:
        note = serialize_note(find_note(note_id))
        metadata = []
        if note["folder"]:
            metadata.append(f"Folder: {note['folder']}")
        if note["tags"]:
            metadata.append(f"Tags: {', '.join(note['tags'])}")
        details = f"\n> {' · '.join(metadata)}\n" if metadata else ""
        body = f"# {note['title']}\n{details}\n{note['content']}\n"
        filename = re.sub(r"[^a-zA-Z0-9_-]+", "-", note["title"]).strip("-") or "note"
        return Response(
            body,
            mimetype="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{filename}.md"'},
        )

    @app.errorhandler(404)
    def not_found(error) -> tuple[Response, int]:
        if request.path.startswith("/api/"):
            return jsonify({"error": getattr(error, "description", "Not found")}), 404
        return error, 404

    return app


if __name__ == "__main__":
    # Port 5000 is commonly reserved by macOS Control Center/AirPlay.
    app = create_app()
    app.run(debug=True, port=5050)
