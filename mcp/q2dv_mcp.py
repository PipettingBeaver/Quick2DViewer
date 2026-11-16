#!/usr/bin/env python3
"""Q2DV domain-layer MCP server.

Exposes the Q2DV agent registry (`mcp/tools.json`, generated from index.html)
over MCP stdio and proxies calls to a running Q2DV host through a local Unix
socket owned by the ChimeraX plugin.

The server never talks to the network. If the host is not running, tool calls
return a typed `host_unavailable` error instead of failing the protocol.
"""

import json
import os
import socket
import sys
import uuid
from pathlib import Path

SERVER_NAME = "q2dv-mcp"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")
DEFAULT_PROTOCOL = PROTOCOL_VERSIONS[0]
AGENT_SCHEMA = "q2dv.agent/1"
HERE = Path(__file__).resolve().parent
TOOLS_FILE = HERE / "tools.json"
SOCKET_PATH = Path(os.environ.get(
    "Q2DV_AGENT_SOCKET",
    str(Path.home() / "Q2DV_files" / "agent" / "agent.sock"),
))

RESOURCES = [
    {"uri": "q2dv://state", "name": "Q2DV state", "description": "Current sequence, selection, tracks, grants and pending decisions.", "mimeType": "application/json"},
    {"uri": "q2dv://snapshot", "name": "Q2DV snapshot", "description": "Bounded session snapshot with sequence hash, tracks and host models.", "mimeType": "application/json"},
    {"uri": "q2dv://tracks", "name": "Q2DV tracks", "description": "Track summaries with source and provenance.", "mimeType": "application/json"},
    {"uri": "q2dv://timeline", "name": "Q2DV agent timeline", "description": "The structured agent action ledger for this session.", "mimeType": "application/json"},
    {"uri": "q2dv://reference", "name": "Q2DV agent tool reference", "description": "Every tool with its tier, approval mode, effects and inputs.", "mimeType": "application/json"},
    {"uri": "q2dv://literature", "name": "Q2DV literature and checklists", "description": "Curated references and blind-spot checklists for vignettes.", "mimeType": "application/json"},
    {"uri": "q2dv://policy", "name": "Q2DV agent policy", "description": "Persisted auto-approve and grant policy.", "mimeType": "application/json"},
]


def log(message):
    print("[%s] %s" % (SERVER_NAME, message), file=sys.stderr, flush=True)


def read_message(stream):
    """Read one newline-delimited MCP message, tolerating LSP-style framing."""
    line = stream.readline()
    while line in (b"\n", b"\r\n"):
        line = stream.readline()
    if not line:
        return None
    if line.lower().startswith(b"content-length:"):
        try:
            length = int(line.split(b":", 1)[1].strip())
        except ValueError:
            return None
        while True:
            header = stream.readline()
            if header in (b"\n", b"\r\n", b""):
                break
        body = stream.read(length)
        return json.loads(body.decode("utf-8")) if body else None
    text = line.decode("utf-8").strip()
    return json.loads(text) if text else read_message(stream)


def write_message(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def rpc_result(request_id, result):
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def rpc_error(request_id, code, message, data=None):
    error = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def host_error(code, message):
    return {
        "schema": "q2dv.agent.result/1",
        "status": "error",
        "error": {"code": code, "message": message, "retryable": code in ("host_unavailable", "host_timeout")},
    }


def host_call(request, timeout=120.0):
    if not SOCKET_PATH.exists():
        return host_error("host_unavailable", "Q2DV host socket not found at %s. Open the Q2DV tool in ChimeraX." % SOCKET_PATH)
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(timeout)
    try:
        client.connect(str(SOCKET_PATH))
    except OSError as exc:
        client.close()
        return host_error("host_unavailable", "Could not connect to the Q2DV host at %s: %s" % (SOCKET_PATH, exc))
    try:
        client.sendall((json.dumps({"request": request}, ensure_ascii=False) + "\n").encode("utf-8"))
        chunks = []
        while True:
            chunk = client.recv(65536)
            if not chunk:
                break
            chunks.append(chunk)
            if chunk.endswith(b"\n"):
                break
        text = b"".join(chunks).decode("utf-8", "replace").strip()
        if not text:
            return host_error("host_timeout", "The Q2DV host closed the connection without a reply.")
        return json.loads(text)
    except socket.timeout:
        return host_error("host_timeout", "The Q2DV host did not answer within %.0fs." % timeout)
    except (OSError, ValueError) as exc:
        return host_error("host_unavailable", "Q2DV host call failed: %s" % exc)
    finally:
        try:
            client.close()
        except OSError:
            pass


def load_tools():
    try:
        payload = json.loads(TOOLS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        log("could not read %s: %s" % (TOOLS_FILE, exc))
        return []
    tools = payload.get("tools")
    return tools if isinstance(tools, list) else []


def find_tool(tools, name):
    for spec in tools:
        if spec.get("name") == name or spec.get("id") == name:
            return spec
    return None


def mcp_tool(spec):
    flags = spec.get("flags") or {}
    return {
        "name": spec.get("name") or spec.get("id"),
        "description": spec.get("title") or "Q2DV action",
        "inputSchema": spec.get("input") or {"type": "object", "properties": {}},
        "annotations": {
            "readOnlyHint": bool(spec.get("readOnly")),
            "destructiveHint": bool(spec.get("destructive")),
            "idempotentHint": bool(spec.get("readOnly")),
            "openWorldHint": bool(flags.get("network")),
        },
    }


def tool_result(payload):
    status = payload.get("status") if isinstance(payload, dict) else None
    is_error = status == "error"
    if status == "human_required":
        decision = payload.get("decision") or {}
        text = "Human approval required: %s (%s). Approve or reject it in Q2DV -> Agent; this call did not run the action." % (
            decision.get("title") or "agent action",
            decision.get("id") or "pending",
        )
    elif is_error:
        error = payload.get("error") or {}
        text = "Q2DV error [%s]: %s" % (error.get("code") or "internal", error.get("message") or "unknown error")
    elif status == "ok":
        text = "Q2DV completed the action."
    else:
        text = "Q2DV returned status %s." % (status or "unknown")
    result = {
        "content": [
            {"type": "text", "text": text},
            {"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=2)},
        ],
        "isError": is_error,
    }
    if isinstance(payload, dict):
        result["structuredContent"] = payload
    return result


def handle_initialize(request_id, params):
    requested = (params or {}).get("protocolVersion")
    version = requested if requested in PROTOCOL_VERSIONS else DEFAULT_PROTOCOL
    return rpc_result(request_id, {
        "protocolVersion": version,
        "capabilities": {
            "tools": {"listChanged": False},
            "resources": {"subscribe": False, "listChanged": False},
            "logging": {},
        },
        "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        "instructions": (
            "Q2DV is the domain layer for protein classification. Start with q2dv_status "
            "or q2dv_snapshot. Imports and other state-changing actions return "
            "human_required until the user approves them in Q2DV -> Agent. Read "
            "q2dv-timeline to follow the action history."
        ),
    })


def handle_tools_list(request_id):
    tools = [mcp_tool(spec) for spec in load_tools()]
    return rpc_result(request_id, {"tools": tools})


def handle_tools_call(request_id, params):
    params = params or {}
    name = params.get("name")
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        return rpc_error(request_id, -32602, "tools/call arguments must be an object")
    spec = find_tool(load_tools(), name)
    if not spec:
        return rpc_error(request_id, -32602, "Unknown tool: %s" % name)
    request = {
        "schema": AGENT_SCHEMA,
        "id": "mcp-" + uuid.uuid4().hex,
        "action": spec.get("id") or name,
        "args": arguments,
        "actor": {"kind": "agent", "id": SERVER_NAME},
    }
    payload = host_call(request)
    return rpc_result(request_id, tool_result(payload))


def handle_resources_list(request_id):
    return rpc_result(request_id, {"resources": RESOURCES})


def resource_request(uri, arguments):
    if uri == "q2dv://state":
        return {"action": "q2dv.status", "args": {}}
    if uri == "q2dv://snapshot":
        return {"action": "q2dv.snapshot", "args": arguments or {"track_limit": 200}}
    if uri == "q2dv://tracks":
        return {"action": "q2dv.list_tracks", "args": arguments or {"limit": 500}}
    if uri == "q2dv://timeline":
        return {"action": "q2dv.ledger", "args": arguments or {}}
    return None


def handle_resources_read(request_id, params):
    params = params or {}
    uri = params.get("uri")
    if uri in ("q2dv://reference", "q2dv://literature", "q2dv://policy"):
        if uri == "q2dv://reference":
            path = HERE / "reference.json"
            if not path.is_file():
                path = HERE / "tools.json"
        elif uri == "q2dv://literature":
            path = HERE / "literature.json"
        else:
            path = Path.home() / "Q2DV_files" / "agent" / "policy.json"
            if not path.is_file():
                text = json.dumps({
                    "schema": "q2dv.policy/1",
                    "auto_approve": {"enabled": False},
                    "grants": {},
                    "note": "No policy file yet.",
                }, indent=2)
                return rpc_result(request_id, {"contents": [{"uri": uri, "mimeType": "application/json", "text": text}]})
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            return rpc_error(request_id, -32603, "Could not read %s: %s" % (uri, exc))
        return rpc_result(request_id, {"contents": [{"uri": uri, "mimeType": "application/json", "text": text}]})
    spec = resource_request(uri, None)
    if not spec:
        return rpc_error(request_id, -32602, "Unknown resource: %s" % uri)
    request = {
        "schema": AGENT_SCHEMA,
        "id": "mcp-" + uuid.uuid4().hex,
        "action": spec["action"],
        "args": spec["args"],
        "actor": {"kind": "agent", "id": SERVER_NAME},
    }
    payload = host_call(request)
    return rpc_result(request_id, {
        "contents": [{
            "uri": uri,
            "mimeType": "application/json",
            "text": json.dumps(payload, ensure_ascii=False, indent=2),
        }],
    })


def dispatch(message):
    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params") or {}
    if method == "initialize":
        return handle_initialize(request_id, params)
    if method == "ping":
        return rpc_result(request_id, {})
    if method == "tools/list":
        return handle_tools_list(request_id)
    if method == "tools/call":
        return handle_tools_call(request_id, params)
    if method == "resources/list":
        return handle_resources_list(request_id)
    if method == "resources/read":
        return handle_resources_read(request_id, params)
    if method in ("notifications/initialized", "notifications/cancelled", "notifications/roots/list_changed"):
        return None
    if request_id is None:
        return None
    return rpc_error(request_id, -32601, "Method not found: %s" % method)


def main():
    log("listening on stdio; host socket %s" % SOCKET_PATH)
    while True:
        try:
            message = read_message(sys.stdin.buffer)
        except (ValueError, UnicodeDecodeError) as exc:
            write_message(rpc_error(None, -32700, "Parse error: %s" % exc))
            continue
        if message is None:
            break
        if not isinstance(message, dict):
            write_message(rpc_error(None, -32600, "Invalid request"))
            continue
        response = dispatch(message)
        if response is not None:
            write_message(response)


if __name__ == "__main__":
    main()
