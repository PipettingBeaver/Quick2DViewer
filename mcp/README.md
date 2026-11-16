# q2dv-mcp

Domain-layer MCP server for Quick2DViewer. It exposes the Q2DV agent registry
over MCP stdio and forwards calls to a running ChimeraX host through a local
Unix socket.

```text
MCP client (OpenCode, Claude, Codex)
  │ stdio (JSON-RPC, newline-delimited)
q2dv-mcp
  │ ~/Q2DV_files/agent/agent.sock (0600)
ChimeraX plugin ── QWebChannel ── Q2DV page
```

The server does not use the network. If ChimeraX is not running, tool calls
return a typed `host_unavailable` error; the protocol still works.

## Tool registry

`tools.json` is generated from the single registry in `index.html`. Regenerate it
after changing `AGENT_TOOLS`:

```bash
npm run agent:tools
```

`npm test` fails if the cache does not match the app registry or the app version.

## Register with an MCP client

Use the real interpreter path; some launchers shim `python3`.

```json
{
  "mcp": {
    "q2dv": {
      "type": "local",
      "command": ["/usr/bin/python3", "/home/tan/PipettingBeaver_Github/Quick2DViewer/mcp/q2dv_mcp.py"],
      "enabled": true
    }
  }
}
```

For a generic stdio client, spawn the same command and speak MCP over stdin and
stdout. Logs go to stderr.

## Host bridge

The ChimeraX plugin starts the socket when the Q2DV tool loads:

- `~/Q2DV_files/agent/` is `0700`; `agent.sock` is `0600`.
- Override the client path with `Q2DV_AGENT_SOCKET`.
- Restart ChimeraX (or close and reopen the Q2DV tool) after updating the plugin.
- The plugin forwards each request to `window.q2dvAgentRequest` and returns the
  versioned `q2dv.agent.result/1` envelope.

If the socket is missing, open the Q2DV tool in ChimeraX and check
`~/Q2DV_files/agent/agent.sock` exists.

## Approval semantics

Read-only tools run immediately. Imports and other state-changing actions return
`human_required` with a decision id. The user approves or rejects it in
**Q2DV → Agent**; the MCP client cannot approve on its own and the usable
approval token is never returned to the client (`approval.token` is null).
Session grants ("Allow imports for today") are also issued in that panel.

## Resources

- `q2dv://state` — status, sequence, selection, tracks, grants, pending decisions.
- `q2dv://snapshot` — bounded session snapshot with sequence hash and models.
- `q2dv://tracks` — track summaries with source and provenance.
- `q2dv://timeline` — structured agent action ledger.
- `q2dv://reference` — every tool with tier, approval mode, effects and inputs.
- `q2dv://literature` — curated references and blind-spot checklists.
- `q2dv://policy` — persisted auto-approve and grant policy.

## Capabilities and commands

`q2dv_host_capabilities` reports the host version, installed `ChimeraX-*`
add-ons and the allowlisted command prefixes. `q2dv_command` runs one reviewed
command through that allowlist; it is `human_required` and can be granted for
the session under the `commands` class. Add-on manifests can live in
`~/Q2DV_files/adapters/*.json`.

`q2dv_mavedb` fetches a public MaveDB score set through the ChimeraX host (the
API has no browser CORS header), caches the CSV, maps HGVS substitutions to the
reference, and returns per-residue coverage/effect/deleterious components with a
combined score and ranked windows. The default is the avGFP scan
`urn:mavedb:00000080-a-2`; the top cluster is selected and a `..._EXP` track is
added. It is `human_required` with the `mavedb` grant class. Cache:
`~/Q2DV_files/datasets/mavedb` (5 files, 200 MB cap).

`q2dv_backup`, `q2dv_clear_input` and `q2dv_restore` manage the host workspace:
backup returns the newest backup path, clear backs up first and removes both the
page input and the host `current.json`, and restore reapplies the latest backup.
The severe “Reset all add-on data...” action stays UI-only. `q2dv_vignette`
assembles a reviewable evidence dossier; it does not approve itself. Session
auto-approve is a human-only Agent-panel toggle, is persisted in
`~/Q2DV_files/agent/policy.json`, and is never exposed as a tool.

`q2dv_reference` / `q2dv://reference` and `AGENT_REFERENCE.md` are generated from
the single tool registry, so a new tool appears in the agent-facing reference
after `npm run agent:tools`. `q2dv_literature` / `q2dv://literature` expose the
curated references and checklists in `mcp/literature.json`.

`q2dv_addon` runs a declared action from `mcp/adapters/*.json` or
`~/Q2DV_files/adapters/*.json`. Manifests are `q2dv.capability/1`; the first
ones cover Mutation Scores and Contacts and are command-only. Arguments are
validated, the rendered command is reviewed, and the existing `commands` grant
applies. See `CHIMERAX_ADDON_AUDIT.md` for the candidate set and the structured
query criteria.

Vignettes are reviewed in the Agent panel: evidence, clusters, checklist,
citations, Accept / Needs revision / Reject and Markdown export. A review is a
human event; acceptance does not promote a claim automatically.

Host calls are appended to `~/Q2DV_files/agent/audit.jsonl` (10 MB cap, two
rotated backups).

## Testing

```bash
npm run test:mcp   # protocol, host-unavailable path, fake-host call, resources
npm test           # includes the MCP suite and the tool-cache check
```

The protocol tests use a fake Unix socket, so they do not need ChimeraX.
