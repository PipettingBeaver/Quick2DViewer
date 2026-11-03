#!/usr/bin/env python3
import json
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "TerC/tools/chimerax_q2dv/ChimeraX-Q2DVFull/src"))
from workspace_store import WorkspaceStore, WORKSPACE_SCHEMA


def payload(n):
    return {
        "schema": WORKSPACE_SCHEMA,
        "saved_at": "2026-10-29T00:00:00Z",
        "app_version": "test",
        "state": {"parsedTracks": {"AA": "M" * n}, "currentProteinLabel": "test"},
    }


def main():
    with tempfile.TemporaryDirectory(prefix="q2dv-workspace-") as tmp:
        store = WorkspaceStore(tmp)
        assert store.load_workspace() == ""
        assert store.load_settings() == {}
        store.save_settings({"window": {"width": 1640, "height": 740}})
        assert store.load_settings()["window"]["width"] == 1640

        store.save_workspace(json.dumps(payload(1)))
        store.save_workspace(json.dumps(payload(2)))
        store.save_workspace(json.dumps(payload(3)))
        assert json.loads(store.load_workspace())["state"]["parsedTracks"]["AA"] == "MMM"

        store.current.write_text("{not-json", encoding="utf-8")
        recovered = json.loads(store.load_workspace())
        assert recovered["state"]["parsedTracks"]["AA"] == "MM", "newest valid backup should be used"

        for n in range(4, 12):
            store.save_workspace(json.dumps(payload(n)))
        assert len(list(store.backups.glob("current-*.json"))) <= 5, "backups should be capped at five"
        assert not list(store.root.glob("*.tmp")), "atomic writes should leave no temp files"

        try:
            store.save_workspace(json.dumps({"schema": "not-q2dv"}))
        except ValueError:
            pass
        else:
            raise AssertionError("invalid workspace schema was accepted")
        print("host workspace tests passed")


if __name__ == "__main__":
    main()
