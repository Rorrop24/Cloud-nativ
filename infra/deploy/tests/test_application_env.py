import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("application_env", Path(__file__).parent / "../write-application-env.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ApplicationEnvironmentTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="punto-gamer-app-test-")
        self.addCleanup(self.directory.cleanup)
        self.target = Path(self.directory.name)
        self.config = {
            "database_password_path": "/db/password", "rabbit_password_path": "/rabbit/password",
            "backend": {"SPRING_PROFILES_ACTIVE": "aws", "DB_URL": "jdbc:mysql://private/database?sslMode=VERIFY_IDENTITY"},
            "bff": {"BACKEND_URL": "http://backend:8082"},
        }
        self.response = {"Parameters": [
            {"Name": "/db/password", "Value": "D" * 40, "Type": "SecureString"},
            {"Name": "/rabbit/password", "Value": "R" * 64, "Type": "SecureString"},
        ]}

    def test_bff_has_no_database_or_broker_secrets(self):
        module.configure(self.config, self.response, self.target)
        backend = (self.target / "backend.env").read_text()
        bff = (self.target / "bff.env").read_text()
        self.assertIn("DB_PASSWORD=" + "D" * 40, backend)
        self.assertIn("RABBITMQ_PASSWORD=" + "R" * 64, backend)
        self.assertNotIn("PASSWORD", bff)
        self.assertIn("BACKEND_URL=http://backend:8082", bff)

    def test_role_environment_keeps_port_profile_and_private_settings_separate(self):
        self.config["backend"].update({"SERVER_PORT": "8082", "AZURE_API_AUDIENCE": "api-id", "OTHER_SETTING": "backend-only"})
        module.configure(self.config, self.response, self.target)
        for service in ("cart", "inventory", "notifications", "rabbit-admin"):
            values = (self.target / (service + ".env")).read_text()
            self.assertIn("DB_PASSWORD=" + "D" * 40, values)
            self.assertIn("AZURE_API_AUDIENCE=api-id", values)
            self.assertNotIn("SERVER_PORT", values)
            self.assertNotIn("SPRING_PROFILES_ACTIVE", values)
            self.assertNotIn("OTHER_SETTING", values)
            self.assertIn("OUTBOX_ENABLED=" + ("true" if service == "cart" else "false"), values)

    def test_missing_secret_does_not_write_files(self):
        self.response["InvalidParameters"] = ["/db/password"]
        with self.assertRaises(ValueError):
            module.configure(self.config, self.response, self.target)
        self.assertFalse((self.target / "backend.env").exists())

    def test_rejects_plaintext_parameter(self):
        self.response["Parameters"][0]["Type"] = "String"
        with self.assertRaises(ValueError):
            module.configure(self.config, self.response, self.target)

    def test_rejects_environment_injection(self):
        self.config["backend"]["DB_URL"] = "safe\nUNSAFE=1"
        with self.assertRaises(ValueError):
            module.configure(self.config, self.response, self.target)
        self.assertFalse((self.target / "backend.env").exists())


if __name__ == "__main__":
    unittest.main()
