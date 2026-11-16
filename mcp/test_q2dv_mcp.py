#!/usr/bin/env python3
"""Protocol tests for mcp/q2dv_mcp.py. Run: npm run test:mcp."""

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "mcp" / "q2dv_mcp.py"
PYTHON = shutil.which("python3") or sys.executable or "/usr/bin/python3"


class FakeHost:
    def __init__(self, path, responses):
        self.path = Path(path)
        self.responses = responses
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.bind(str(self.path))
        self.sock.listen(8)
        self.stopped = False
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        while not self.stopped:
            try:
                conn, _ = self.sock.accept()
            except OSError:
                return
            with conn:
                data = b""
                while not data.endswith(b"\n"):
                    chunk = conn.recv(65536)
                    if not chunk:
                        break
                    data += chunk
                try:
                    message = json.loads(data.decode("utf-8"))
                except ValueError:
                    continue
                request = message.get("request") or {}
                action = request.get("action")
                payload = self.responses.get(action) or {
                    "schema": "q2dv.agent.result/1",
                    "status": "ok",
                    "data": {"action": action},
                }
                conn.sendall((json.dumps(payload) + "\n").encode("utf-8"))

    def close(self):
        self.stopped = True
        try:
            self.sock.close()
        except OSError:
            pass
        try:
            self.path.unlink()
        except OSError:
            pass


class McpProcess:
    def __init__(self, socket_path):
        env = dict(os.environ)
        env["Q2DV_AGENT_SOCKET"] = str(socket_path)
        self.proc = subprocess.Popen(
            [PYTHON, str(SERVER)],
            cwd=str(ROOT),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

    def send(self, payload):
        self.proc.stdin.write(json.dumps(payload) + "\n")
        self.proc.stdin.flush()

    def recv(self):
        line = self.proc.stdout.readline()
        return json.loads(line) if line else None

    def call(self, method, params=None, request_id=1):
        message = {"jsonrpc": "2.0", "id": request_id, "method": method}
        if params is not None:
            message["params"] = params
        self.send(message)
        return self.recv()

    def close(self):
        try:
            self.proc.stdin.close()
        except OSError:
            pass
        self.proc.terminate()
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        for stream in (self.proc.stdout, self.proc.stderr):
            try:
                stream.close()
            except OSError:
                pass


class McpProtocolTests(unittest.TestCase):
    def test_initialize_registry_and_host_unavailable(self):
        with tempfile.TemporaryDirectory(prefix="q2dv-mcp-") as tmp:
            sock = Path(tmp) / "agent.sock"
            proc = McpProcess(sock)
            try:
                init = proc.call("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "0"}})
                self.assertEqual(init["result"]["serverInfo"]["name"], "q2dv-mcp")
                self.assertEqual(init["result"]["protocolVersion"], "2025-06-18")
                proc.send({"jsonrpc": "2.0", "method": "notifications/initialized"})
                tools = proc.call("tools/list", {}, 2)
                self.assertEqual(len(tools["result"]["tools"]), 21)
                names = [t["name"] for t in tools["result"]["tools"]]
                self.assertIn("q2dv_status", names)
                self.assertIn("q2dv_snapshot", names)
                self.assertTrue(all(n.startswith("q2dv_") for n in names))
                resources = proc.call("resources/list", {}, 3)
                self.assertEqual(len(resources["result"]["resources"]), 7)
                reference = proc.call("resources/read", {"uri": "q2dv://reference"}, 6)
                self.assertIn("q2dv.reference/1", reference["result"]["contents"][0]["text"])
                literature = proc.call("resources/read", {"uri": "q2dv://literature"}, 7)
                self.assertIn("q2dv.literature/1", literature["result"]["contents"][0]["text"])
                policy = proc.call("resources/read", {"uri": "q2dv://policy"}, 8)
                self.assertIn("q2dv.policy/1", policy["result"]["contents"][0]["text"])
                call = proc.call("tools/call", {"name": "q2dv_status", "arguments": {}}, 4)
                self.assertTrue(call["result"]["isError"])
                text = " ".join(c["text"] for c in call["result"]["content"])
                self.assertIn("host_unavailable", text)
                pong = proc.call("ping", {}, 5)
                self.assertEqual(pong["result"], {})
            finally:
                proc.close()

    def test_host_call_and_resources(self):
        with tempfile.TemporaryDirectory(prefix="q2dv-mcp-") as tmp:
            sock = Path(tmp) / "agent.sock"
            host = FakeHost(sock, {
                "q2dv.status": {
                    "schema": "q2dv.agent.result/1",
                    "status": "ok",
                    "data": {"schema": "q2dv.agent/1", "app_version": "test", "tracks": 2},
                },
                "q2dv.ledger": {
                    "schema": "q2dv.agent.result/1",
                    "status": "ok",
                    "data": {"schema": "q2dv.ledger/1", "events": []},
                },
            })
            proc = McpProcess(sock)
            try:
                proc.call("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}}, 1)
                call = proc.call("tools/call", {"name": "q2dv_status", "arguments": {}}, 2)
                self.assertFalse(call["result"]["isError"])
                self.assertEqual(call["result"]["structuredContent"]["data"]["app_version"], "test")
                state = proc.call("resources/read", {"uri": "q2dv://state"}, 3)
                text = state["result"]["contents"][0]["text"]
                self.assertIn("test", text)
                timeline = proc.call("resources/read", {"uri": "q2dv://timeline"}, 4)
                self.assertIn("q2dv.ledger/1", timeline["result"]["contents"][0]["text"])
            finally:
                proc.close()
                host.close()

    def test_unknown_tool_and_method(self):
        with tempfile.TemporaryDirectory(prefix="q2dv-mcp-") as tmp:
            proc = McpProcess(Path(tmp) / "agent.sock")
            try:
                proc.call("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}}, 1)
                unknown = proc.call("tools/call", {"name": "q2dv_missing", "arguments": {}}, 2)
                self.assertEqual(unknown["error"]["code"], -32602)
                method = proc.call("does/not/exist", {}, 3)
                self.assertEqual(method["error"]["code"], -32601)
                bad_resource = proc.call("resources/read", {"uri": "q2dv://nope"}, 4)
                self.assertEqual(bad_resource["error"]["code"], -32602)
            finally:
                proc.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
