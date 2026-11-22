import datetime
import json
import os
import pathlib
import shutil

WORKSPACE_SCHEMA = "q2dv.workspace/1"
DEFAULT_WINDOW = (1640, 740)
MIN_WINDOW = (900, 600)


class WorkspaceStore:
    def __init__(self, root):
        self.root = pathlib.Path(root) / "workspace"
        self.current = self.root / "current.json"
        self.backups = self.root / "backups"
        self.settings = self.root / "settings.json"
        self.root.mkdir(parents=True, exist_ok=True)
        self.backups.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _read_json(path, default=None):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default

    @staticmethod
    def _atomic_write(path, text):
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        tmp.replace(path)

    def load_settings(self):
        data = self._read_json(self.settings, {})
        return data if isinstance(data, dict) else {}

    def save_settings(self, data):
        self._atomic_write(self.settings, json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    def _prune_backups(self, keep=5):
        try:
            files = sorted(
                self.backups.glob("current-*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            for old in files[keep:]:
                old.unlink(missing_ok=True)
        except Exception:
            pass

    def _backup_current(self):
        if not self.current.is_file():
            return
        try:
            stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H-%M-%S-%f")
            shutil.copy2(self.current, self.backups / ("current-%s.json" % stamp))
            self._prune_backups()
        except Exception:
            pass

    def save_workspace(self, text):
        raw = str(text or "")
        if not raw:
            raise ValueError("empty workspace")
        if len(raw.encode("utf-8")) > 50 * 1024 * 1024:
            raise ValueError("workspace too large")
        payload = json.loads(raw)
        if not isinstance(payload, dict) or payload.get("schema") != WORKSPACE_SCHEMA:
            raise ValueError("unsupported workspace schema")
        self._backup_current()
        self._atomic_write(
            self.current,
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        )
        return str(self.current)

    def load_workspace(self):
        candidates = [self.current]
        try:
            candidates += sorted(
                self.backups.glob("current-*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
        except Exception:
            pass
        for path in candidates:
            try:
                text = path.read_text(encoding="utf-8")
                payload = json.loads(text)
                if isinstance(payload, dict) and payload.get("schema") == WORKSPACE_SCHEMA:
                    return text
            except Exception:
                continue
        return ""

    def clear_current(self):
        """Back up the current workspace and remove it so a reload starts empty."""
        if not self.current.is_file():
            return ""
        self._backup_current()
        self.current.unlink(missing_ok=True)
        return str(self.current)

    def restore_latest(self):
        """Restore the newest valid backup into current and return its text."""
        try:
            candidates = sorted(
                self.backups.glob("current-*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
        except Exception:
            return ""
        for path in candidates:
            try:
                text = path.read_text(encoding="utf-8")
                payload = json.loads(text)
                if isinstance(payload, dict) and payload.get("schema") == WORKSPACE_SCHEMA:
                    self._atomic_write(self.current, text)
                    return text
            except Exception:
                continue
        return ""
