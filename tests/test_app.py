import tempfile
import unittest
from pathlib import Path

from app import create_app


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

    def test_tags_are_trimmed_and_deduplicated(self):
        response = self.client.post("/api/notes", json={"tags": " work,Work, ideas ,"})
        self.assertEqual(response.get_json()["tags"], ["work", "ideas"])


if __name__ == "__main__":
    unittest.main()
