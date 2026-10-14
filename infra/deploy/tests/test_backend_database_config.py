import ast
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class BackendDatabaseConfigTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="punto-gamer-config-test-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.target = self.root / "backend.env"
        self.parameters = self.root / "parameters.json"
        self.target.write_text("AZURE_API_AUDIENCE=existing\nRABBITMQ_ADDRESSES=10.0.1.1:5672\nDB_PASSWORD=old\n")
        self.original = self.target.read_text()
        self.response = {
            "Parameters": [
                {"Name": "/db/password", "Type": "SecureString", "Value": "A" * 40},
                {"Name": "/rabbit/password", "Type": "SecureString", "Value": "B" * 64},
            ],
            "InvalidParameters": [],
        }
        source = (Path(__file__).parent / "../Configure-BackendDatabase.sh").read_text()
        embedded = source.split("<<'PY'\n", 1)[1].split("\nPY\n", 1)[0]
        tree = ast.parse(embedded)
        # Solo las pruebas redirigen el destino root a su directorio temporal.
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and node.value == "/etc/punto-gamer/backend.env":
                node.value = str(self.target)
        self.code = compile(tree, "Configure-BackendDatabase.sh:python", "exec")

    def execute(self):
        self.parameters.write_text(json.dumps(self.response))
        argv = ["-", str(self.parameters), "test.example.us-east-1.rds.amazonaws.com",
                "punto_gamer", "punto_gamer", "/db/password", "/rabbit/password"]
        output = io.StringIO()
        with patch("sys.argv", argv), contextlib.redirect_stdout(output):
            exec(self.code, {})
        return output.getvalue()

    def test_updates_secrets_preserves_other_configuration_and_requires_tls(self):
        self.assertEqual(self.execute(), "")
        content = self.target.read_text()
        self.assertIn("AZURE_API_AUDIENCE=existing\n", content)
        self.assertIn("RABBITMQ_ADDRESSES=10.0.1.1:5672\n", content)
        self.assertIn("SPRING_PROFILES_ACTIVE=aws\n", content)
        self.assertIn("sslMode=VERIFY_IDENTITY", content)
        self.assertEqual(content.count("DB_PASSWORD="), 1)
        self.assertNotIn("DB_PASSWORD=old", content)
        self.assertIn("DB_PASSWORD=" + "A" * 40, content)

    def test_missing_parameter_leaves_environment_unchanged(self):
        self.response["InvalidParameters"] = ["/db/password"]
        with self.assertRaises(SystemExit):
            self.execute()
        self.assertEqual(self.target.read_text(), self.original)

    def test_non_encrypted_parameter_leaves_environment_unchanged(self):
        self.response["Parameters"][0]["Type"] = "String"
        with self.assertRaises(SystemExit):
            self.execute()
        self.assertEqual(self.target.read_text(), self.original)

    def test_oversized_mysql_password_leaves_environment_unchanged(self):
        self.response["Parameters"][0]["Value"] = "A" * 64
        with self.assertRaises(SystemExit):
            self.execute()
        self.assertEqual(self.target.read_text(), self.original)


if __name__ == "__main__":
    unittest.main()
