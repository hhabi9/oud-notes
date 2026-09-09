import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import create_app
from desktop import application_support_dir, main


class NotesApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = str(Path(self.temp_dir.name) / "test.db")
        self.app = create_app({"TESTING": True, "DATABASE": database})
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_complete_note_lifecycle(self):
        created = self.client.post(
            "/api/notes",
            json={"title": "Book ideas", "folder": "Writing", "tags": ["ideas", "books"]},
        )
        self.assertEqual(created.status_code, 201)
        note = created.get_json()
        self.assertEqual(note["tags"], ["ideas", "books"])

        updated = self.client.patch(
            f"/api/notes/{note['id']}",
            json={"content": "A quiet opening scene", "pinned": True},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertTrue(updated.get_json()["pinned"])

        search = self.client.get("/api/notes?q=opening").get_json()
        self.assertEqual([item["id"] for item in search], [note["id"]])

        filtered = self.client.get("/api/notes?folder=Writing").get_json()
        self.assertEqual(len(filtered), 1)

        exported = self.client.get(f"/api/notes/{note['id']}/export")
        self.assertEqual(exported.status_code, 200)
        self.assertIn("# Book ideas", exported.get_data(as_text=True))
        self.assertIn("attachment", exported.headers["Content-Disposition"])

        deleted = self.client.delete(f"/api/notes/{note['id']}")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get("/api/notes").get_json(), [])

    def test_missing_note_returns_json_404(self):
        response = self.client.get("/api/notes/999")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "Note not found"})

    def test_backup_import_roundtrip_preserves_notes(self):
        original = self.client.post('/api/notes', json={'title': 'Study', 'content': '# Hello\n你好', 'folder': 'School', 'tags': ['exam'], 'pinned': True}).get_json()
        backup = self.client.get('/api/backup')
        self.assertIn('attachment', backup.headers['Content-Disposition'])
        response = self.client.post('/api/import', json=backup.get_json())
        self.assertEqual(response.status_code, 201)
        notes = self.client.get('/api/notes').get_json()
        self.assertEqual(len(notes), 2)
        for note in notes:
            self.assertEqual({k: v for k, v in note.items() if k != 'id'}, {k: v for k, v in original.items() if k != 'id'})

    def test_import_invalid_batch_is_atomic(self):
        response = self.client.post('/api/import', json={'format': 'oud-notes', 'version': 1, 'notes': [{'title': 'valid'}, {'content': 42}]})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get('/api/notes').get_json(), [])

    def test_import_rejects_unknown_backup_version(self):
        self.assertEqual(self.client.post('/api/import', json={'format': 'oud-notes', 'version': 2, 'notes': []}).status_code, 400)

    def test_create_rejects_non_object_json(self):
        for payload in (["unexpected"], [], "text", 3, False):
            with self.subTest(payload=payload):
                response = self.client.post('/api/notes', json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json(), {"error": "Expected a JSON object"})
        self.assertEqual(self.client.get('/api/notes').get_json(), [])

    def test_tags_are_trimmed_and_deduplicated(self):
        response = self.client.post("/api/notes", json={"tags": " work,Work, ideas ,"})
        self.assertEqual(response.get_json()["tags"], ["work", "ideas"])

    def test_desktop_data_uses_application_support(self):
        with patch("desktop.Path.home", return_value=Path("/Users/tester")):
            self.assertEqual(
                application_support_dir(),
                Path("/Users/tester/Library/Application Support/Oud Notes"),
            )

    def test_desktop_preserves_recovery_storage_between_launches(self):
        with patch('desktop.create_desktop_app'), patch('desktop.webview.create_window') as window, patch('desktop.webview.start') as start:
            main()
        self.assertEqual(window.call_args.kwargs['http_port'], 5051)
        self.assertFalse(start.call_args.kwargs['private_mode'])
        self.assertEqual(start.call_args.kwargs['storage_path'], str(application_support_dir() / 'webview'))

    def test_offline_markdown_assets_are_bundled(self):
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"vendor/marked.umd.js", page.data)
        self.assertIn(b"vendor/mermaid.min.js", page.data)

        for asset in (
            "marked.umd.js",
            "marked-footnote.umd.js",
            "marked-katex.umd.js",
            "purify.min.js",
            "highlight.min.js",
            "mermaid.min.js",
            "katex.min.css",
        ):
            response = self.client.get(f"/static/vendor/{asset}")
            self.assertEqual(response.status_code, 200)
            response.close()


if __name__ == "__main__":
    unittest.main()
