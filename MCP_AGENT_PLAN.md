# Agent access plan: q2dv-mcp, capability registry, and step-flow review

**Status:** Phase 1 logic layer and the Phase 2 decision queue implemented
2026-11-15 (Q2DV 0.72.3). Host adapter, MCP transport and step-flow timeline
remain. Not a production dependency.
**Baseline:** Q2DV 0.72.1, ChimeraX host 0.6.35, ChimeraX 1.12.
**Related:** `RECIPE_MODEL.md`, `CHIMERAX_ECOSYSTEM.md`,
`CHIMERAX_PLUGIN_PLAN.md`, `CHIMERAX_INTEGRATION_PLAN.md`, `DESIGN.md`.

## 1. Decision

There is **one MCP server**, `q2dv-mcp`, and it is the domain layer. It exposes
Q2DV recipes as tools, proxies ChimeraX and add-on capabilities through a host
adapter, and returns reviewable decisions rather than performing hidden work.

- Q2DV is the **single source of truth (SSOT) for classification state**:
  reference sequence, tracks, claims, relations, features, residue ranges,
  provenance, recipes and decisions.
- ChimeraX is the **geometry and scene authority**: models, chains, selections,
  measurements, add-on results, figures.
- External datasets are **providers**: versioned, cached snapshots with a
  source, licence and retrieval time. They are evidence, not truth.
- `q2dv-mcp` is a **supplement for human work**, never a production dependency.
  The UI remains fully usable with it disabled or absent.
- Every agent action is **visible and steppable** in the UI. Nothing is a
  black box, and no hidden reasoning is required to review a step.

ChimeraX's own MCPServer (`MCPServer` 0.2.0, guarded) is not replaced or
wrapped in this plan. It remains a later integration angle; if used, the plugin
can register `q2dv <recipe>` commands so ChimeraX's server reaches the same
capabilities with fewer structured guarantees.

## 2. Goals and non-goals

Goals:

1. An external agent can read the **same evidence a human sees** through one
   structured snapshot, not by guessing from a description.
2. An agent can propose work as `require-human`, `agent-run`, or `info`
   decisions, rendered inline beside the relevant track or selection.
3. An agent can run allowed actions (import, analyse, select, compare) and be
   followed step by step with rationale, evidence, before/after and timing.
4. ChimeraX base commands and **installed add-ons** are reachable through
   declarative capability manifests, not hardcoded names.
5. The same actions are reproducible headlessly as scenarios for testing and
   live as a visual demo.
6. Contracts survive ChimeraX and add-on version changes, and degrade with a
   typed error instead of a crash.

Non-goals (now):

- Replacing ChimeraX's MCPServer, or exposing raw Python execution to an agent.
- MCP access from the plain browser build.
- Autonomous destructive edits, sequence replacement, or claim promotion.
- Exposing model chain-of-thought. Rationale is structured, checkable text plus
  evidence references.

## 3. Principles

1. **SSOT boundary.** One owner per field class. Conflicts are resolved by rule,
   never by last writer. Q2DV never stores geometry as truth; ChimeraX never
   becomes the classification store.
2. **Contract-first.** Every boundary has a versioned JSON schema. Unknown
   fields are ignored; ids are never reused; changes are additive within a
   major schema.
3. **Capability discovery, not hardcoding.** The plugin probes what ChimeraX and
   its add-ons can do at runtime. A manifest describes an add-on; an unknown
   add-on still works through reviewed command execution.
4. **Human-first, fail-closed.** Read-only work may run unattended. Anything
   that changes sequence, deletes state, writes files or calls the network is
   `require-human` unless a session grant says otherwise.
5. **Observable by construction.** Every call is an event with tool, args,
   rationale bullets, evidence, result, duration and actor. The UI renders the
   event stream; MCP progress notifications mirror it.
6. **Reproducible.** A scenario file reproduces a live session headlessly, with
   expected invariants and typed failures.
7. **One registry.** Tools are declared once and projected to the in-page
   dispatcher, the MCP server, the docs and the tests. No parallel tool lists.
8. **Proportional autonomy.** Autonomy is a policy decision, not a model
   decision. The agent proposes a tier; the policy file decides.
9. **Version-aware.** App, host, ChimeraX and each add-on report versions; a
   capability probe records what was actually tested.

## 4. Architecture

```text
MCP client (OpenCode, another agent)
  │  MCP over stdio
  ▼
q2dv-mcp  (Python; domain layer)
  ├─ tool registry (from q2dv.tool/1 specs)
  ├─ resources: q2dv://state, q2dv://tracks/{id}, q2dv://timeline
  ├─ job manager (ids, progress, cancel)
  └─ host client
       │  Unix socket ~/Q2DV_files/agent/agent.sock (0600)
       ▼
ChimeraX plugin (host adapter)
  ├─ QWebChannel transport ──► Q2DV page
  │     ├─ agent dispatcher (recipe registry)
  │     ├─ decision engine + policy
  │     └─ event/timeline store
  ├─ capability registry
  │     ├─ chimerax.base (commands, models, selection, figures)
  │     ├─ addon manifests (query/execute adapters)
  │     └─ generic command fallback (reviewed)
  └─ Q2DV agent API ──► existing core functions
```

Responsibilities:

| Layer | Owns | Never does |
|---|---|---|
| Q2DV page | sequence, tracks, claims, features, selection, decisions, audit | model geometry, add-on internals |
| Host adapter | ChimeraX/session bridge, capability probing, file vault | reinterpret Q2DV science |
| `q2dv-mcp` | tool schemas, jobs, policy enforcement at the edge, resources | contain domain logic |
| Capability manifests | add-on contract, version, probe, result mapping | execute unreviewed commands |
| External providers | fetch, normalise, cache, licence | overwrite accepted claims |

The transport is an interface, not an assumption: QWebChannel today, a local
HTTP/WebSocket bridge or an in-process adapter later. Only the host adapter and
`q2dv-mcp` know the transport.

## 5. Data contracts

Schemas live in one place and are validated on both sides. Names start with
`q2dv.` and carry a major version.

### 5.1 Agent envelope (`q2dv.agent/1`)

```json
{
  "schema": "q2dv.agent/1",
  "id": "req-0007",
  "action": "run",
  "args": { "recipe": "q2dv.map.ss", "context": { "ranges": [[58, 64]] } },
  "actor": { "kind": "agent", "id": "opencode", "model": "provider/model" },
  "rationale": ["The SS track is empty for the selected region."],
  "evidence": [{ "kind": "track", "id": "SS_Q2D" }]
}
```

Response: `{ "schema": "q2dv.agent.result/1", "id": "req-0007", "status": "ok" | "pending_human" | "blocked" | "partial" | "error", "data": {}, "job": "job-12", "error": { "code": "", "message": "", "retryable": false } }`.

### 5.2 Snapshot (`q2dv.snapshot/1`)

Bounded by default. The agent asks for sections and a byte budget; full tracks
are paged, never dumped.

```json
{
  "schema": "q2dv.snapshot/1",
  "app_version": "0.72.1",
  "host": { "kind": "chimerax", "version": "0.6.35" },
  "sequence": { "sha256": "…", "length": 238, "bundle": "gfp-p42212-public" },
  "selection": { "mode": "point", "ranges": [[58, 64]], "author": "1-64" },
  "tracks": [{ "id": "SS_Q2D", "kind": "ss", "source": "Quick2D", "residues": 238 }],
  "claims": { "accepted": 4, "proposed": 2 },
  "models": [{ "id": "#1", "chain": "A", "file": "1GFL", "mapping": "aligned" }],
  "jobs": [{ "id": "job-11", "status": "running", "progress": { "done": 40, "total": 238 } }],
  "truncated": false
}
```

Every residue range carries **both** the 0-based reference index and the author
numbering, plus the mapping provenance. Raw numbering is never assumed.

### 5.3 Event (`q2dv.event/1`)

```json
{
  "schema": "q2dv.event/1",
  "seq": 12,
  "at": "2026-11-15T18:04:12Z",
  "actor": { "kind": "agent", "id": "opencode", "model": "provider/model" },
  "call": { "tool": "q2dv_run", "args": { "recipe": "q2dv.compare.ss-structure" } },
  "rationale": ["Structure and prediction disagree over 58-64."],
  "evidence": [{ "kind": "track", "id": "SS_Q2D" }, { "kind": "model", "id": "#1/A" }],
  "status": "ok",
  "duration_ms": 812,
  "result": { "summary": "helix recall 0.86", "refs": ["concordance:dec-0042"] },
  "decision_id": null
}
```

### 5.4 Decision (`q2dv.decision/1`)

```json
{
  "schema": "q2dv.decision/1",
  "id": "dec-0042",
  "tier": "require-human",
  "title": "Compare predicted SS with 1GFL HELIX/SHEET",
  "why": "SS track and structure disagree over residues 58-64.",
  "evidence": { "track": "SS_Q2D", "ranges": [[58, 64]], "model": "#1/A" },
  "action": { "recipe": "q2dv.compare.ss-structure", "args": {} },
  "flags": { "reversible": true, "network": false, "destructive": false,
             "writes_files": false, "changes_sequence": false },
  "expected": "recall 0.86, agreement 0.91",
  "approval": { "mode": "click", "token": null, "expires_at": null }
}
```

Tiers and behaviour:

| Tier | UI | MCP result |
|---|---|---|
| `require-human` | Card with Run / Edit / Reject; nothing executes | `pending_human` + id; resolution event later |
| `agent-run` | Runs, logs, then shows a review card with Undo | `ok` + before/after |
| `info` | Anchored note, no action | `ok` |
| `denied` | Policy refusal, reason shown | `blocked` + reason |

### 5.5 Capability (`q2dv.capability/1`)

```json
{
  "schema": "q2dv.capability/1",
  "id": "chimerax.contacts",
  "kind": "base",
  "bundle": "ChimeraX",
  "version": "1.12",
  "probe": { "command": "contacts" },
  "actions": [
    { "id": "chimerax.contacts.query", "mode": "query",
      "args": { "atoms": "string", "radius": "number" },
      "returns": "q2dv.handoff/1" }
  ],
  "limits": { "timeout_s": 30, "max_rows": 5000 },
  "tested_with": "ChimeraX 1.12"
}
```

Manifests are data. Built-ins ship with the plugin; local ones live in
`~/Q2DV_files/adapters/*.json`. A manifest can point to a Python adapter module
for transforms that cannot be expressed as a command.

### 5.6 Handoff (`q2dv.handoff/1`)

The only way add-on results enter Q2DV:

```json
{
  "schema": "q2dv.handoff/1",
  "source": { "capability": "chimerax.contacts", "version": "1.12", "method": "contacts" },
  "target": { "model": "#1", "chain": "A", "sequence_sha256": "…" },
  "mapping": { "kind": "aligned", "method": "chain-sequence", "shift": 0 },
  "values": [{ "kind": "range", "from": 58, "to": 64, "label": "interface" }],
  "confidence": { "kind": "categorical", "value": "observed" },
  "files": [],
  "fetched_at": "2026-11-15T18:04:12Z"
}
```

Results enter as **proposed** tracks with `trackMeta` provenance. Accepted claims
are promoted only by a human action.

### 5.7 Tool spec (`q2dv.tool/1`) and scenario (`q2dv.scenario/1`)

The tool spec is the single source for MCP schemas, the in-page dispatcher and
tests. MCP names are the spec id with `.` → `_` (`q2dv.import` →
`q2dv_import`) to satisfy `^[a-zA-Z0-9_-]{1,64}$`.

Scenarios are the reproducible form of a live session (see §12).

### 5.8 Errors

`{ "code": "validation" | "precondition" | "capability_missing" | "policy_denied"
| "human_required" | "upstream_network" | "timeout" | "cancelled" | "partial"
| "internal", "message": "", "retryable": false, "details": {} }`

`partial` is a success with missing sections, never a silent success.

## 6. Q2DV agent API (in-page)

One dispatcher, `agentRequest(request)`, plus a job channel. It maps to existing
functions; it adds no new science.

- `status`, `snapshot`, `list_tracks`, `read_track`
- `import` (sequence, PDB ID, local file), `run` (recipe id + context)
- `select`, `compare` (concordance), `export` (workspace, FASTA, report)
- `propose` (decision), `decide` (id + token), `scenario`
- `describe` (tool specs and capability manifests)

Rules:

- No arbitrary JS evaluation from MCP. Only registered actions with validated
  args.
- Long work returns a job id and emits events; the UI shows progress, elapsed
  time and an ETA where known.
- Every mutation is idempotent by request id; a retry with the same id returns
  the original result.
- Cancellation is cooperative at step boundaries, matching the macro runner.

## 7. ChimeraX capability adapter

The adapter is the **only** place that knows ChimeraX specifics:

```text
probe()      -> capability manifests (base + installed add-ons)
query(id,args)-> q2dv.handoff/1 (read-only)
execute(id,args)-> q2dv.handoff/1 + side effects (reviewed)
models()     -> model/chain/sequence context and residue mapping
saveImage()  -> figure path for the step-flow timeline
```

Discovery:

1. Base capabilities are declared in a shipped manifest, probed by command
   availability (`help`/command registry) and version.
2. Add-ons declare manifests under `~/Q2DV_files/adapters/`; the shipped set is
   a curated subset from `CHIMERAX_ECOSYSTEM.md` with `tested_with` recorded.
3. Unknown add-ons are still usable through `chimerax.command`, which runs an
   allowlisted command and captures output. Command text is always shown and
   confirmed before execution.
4. A probe result is cached with the ChimeraX version and the add-on version and
   invalidated when either changes.
5. First adapters (decided 2026-11-15): MolCompose and PICKLUSTER for structured
   queries, plus one command-only add-on (AllMetal3D or MIC) to exercise the
   fallback path.

Failure isolation: a missing or broken add-on yields `capability_missing`; other
capabilities stay available. No import-time failure of the whole adapter.

## 8. External datasets

Generalise the existing provider pattern (`VARIANT_EFFECT_PROVIDERS`) into a
provider interface:

```text
probe() -> availability, licence, external: true|false
fetch(context) -> normalised values + source version + fetched_at
cache_key = sha256(sequence) + provider + version
```

- Outbound calls still go through Options → Data Sources (on for the deployed
  site, off for `file://`) and are never enabled by the agent.
- Cache entries carry a TTL and a retention budget; snapshots are immutable.
- Providers report `proposed` evidence; conflict rules in §9 apply.

## 9. SSOT and conflict rules

| Field class | Owner | Recorded with |
|---|---|---|
| reference sequence | Q2DV | source bundle, sha256 |
| tracks | Q2DV | source, method, version, `proposed`/`accepted` |
| claims, relations, features | Q2DV | author, evidence ids, review status |
| selection | Q2DV (mirrored to ChimeraX) | ranges, author numbering, mapping |
| model geometry, scene, figures | ChimeraX | model id, file hash, chain mapping |
| external values | provider snapshot | source, version, fetched_at |

Rules:

- Same track id from a different source is namespaced, never merged silently.
- A re-run replaces only its own namespace and archives the previous result.
- Predictions are `proposed`; only a human promotes a claim.
- A sequence hash mismatch invalidates mappings and blocks the action.
- Last-writer never wins across field classes.

## 10. Decisions and policy

Policy file `~/Q2DV_files/agent/policy.json`, versioned with the workspace and
editable in Options:

```json
{
  "schema": "q2dv.policy/1",
  "default_tier": "require-human",
  "rules": [
    { "match": { "readOnly": true }, "tier": "agent-run" },
    { "match": { "network": true }, "tier": "require-human" },
    { "match": { "changes_sequence": true }, "tier": "require-human", "token": true },
    { "match": { "destructive": true }, "tier": "denied" }
  ],
  "session_grants": [],
  "demo_mode": { "allow_agent_run": true, "max_steps": 40 }
}
```

- Approval tokens are minted at proposal time, bound to the exact `(tool, args)`,
  single-use, expiring, and refused on edit or replay.
- Grants are explicit and scoped: **Allow once**, **Allow for today** (session
  grant, cleared at local midnight or app restart), **Always** (policy change,
  shown in the diff), **Pause here** (block the playhead until a human decides).
  They apply to any persistent action class, not just imports — for example
  removing homologs that are skewing a calculation, deleting a track, or saving
  over a workspace.
- Every grant is revocable from the same card and from the policy editor, and
  carries the action class, actor and expiry into the audit log.
- `agent-run` is limited to reversible actions; Undo is offered in the review
  card.
- Every decision and token appears in the audit log
  (`~/Q2DV_files/agent/audit.jsonl`), rotated and capped.

## 11. Step-flow and demo mode

The step-flow panel is a first-class surface, not a debug log.

**One action ledger, three consumers.** Human actions, macro steps and agent
calls are recorded in a single append-only ledger with `actor`
(`human`/`agent`/`macro`), tool, args, rationale, evidence, before/after and
result. The macro recorder becomes a view of this ledger; the step-flow panel
renders it; export writes it as a scenario. A human can replay an agent run
step by step, and an agent can replay a human run to reproduce a bug. This is
the shared substrate for troubleshooting and comparative analysis.

- **Timeline:** one row per event: tool, rationale bullets, evidence chips,
  status, duration, result summary.
- **Controls:** Play/Pause, Step, Replay, Jump to state, and Open evidence
  (selects the range, focuses the track or model).
- **Diff:** tracks added/removed, selection before/after, concordance values,
  model state. Undo for `agent-run` steps.
- **Why, not chain-of-thought:** show the agent's structured rationale and the
  evidence it used. Do not scrape or display hidden reasoning.
- **Decisions inline:** a `require-human` card blocks the playhead; Run/Edit/
  Reject resumes it.
- **Recording:** export the timeline as a scenario file that reproduces the
  session headlessly.
- **Demo mode:** adjustable speed, expandable steps, one screenshot per step
  via the host adapter, and a summary card at the end.
- **States:** empty, waiting for host, running with progress/ETA, partial,
  error, cancelled. Keyboard and screen-reader support per `UX_GUIDELINES.md`.

## 12. Testing

| Layer | Test |
|---|---|
| dispatcher, policy, decision classification | VM checks in `tests/run.js` (pure functions) |
| schemas and registry | contract tests: every tool spec validates, has a handler and a test |
| capability adapter | fake host + recorded handoff fixtures |
| residue numbering | a mapping oracle: synthetic identical, shifted, truncated, renumbered and mismatched chains; both directions must round-trip |
| prompt injection | fixtures that look like commands (PDB remarks, UniProt names, add-on messages) must never become actions |
| MCP server | stdio client smoke test: list tools/resources, call, progress, cancel |
| live end to end | scenario runner on GFP and LacY |
| UI | manual QA cards in `QA_CHECKLIST.md` (harness cannot verify layout/events) |

Scenario example:

```json
{
  "schema": "q2dv.scenario/1",
  "fixtures": ["GFP"],
  "steps": [
    { "run": "q2dv.import", "args": { "sequence": "GFP" } },
    { "run": "q2dv.import", "args": { "pdb": "1GFL" } },
    { "run": "q2dv.run", "args": { "recipe": "q2dv.map.ss" } },
    { "run": "q2dv.compare", "args": { "track": "SS_Q2D", "structure": "1GFL" } },
    { "assert": "concordance.agreement >= 0.85" }
  ]
}
```

## 13. Build order

Adjusted from the earlier list to put the contracts and capability registry in
the foundation; the phases otherwise match.

| Phase | Deliverable | Acceptance |
|---|---|---|
| 1 | Contracts, tool registry, in-page dispatcher, host-adapter interface with a fake adapter | Every recipe reaches an existing function through validated args; typed errors; no UI change; tests green |
| 2 | Decision engine, policy evaluation, consent tokens, inline decision cards | Tier matrix and token binding tested; cards usable by keyboard; manual QA card |
| 3 | `q2dv-mcp` over the Unix socket, tools generated from the registry, resources, jobs/progress | Client enumerates tools/resources; GFP import + SS + concordance smoke test; `host_unavailable` path |
| 4 | Step-flow timeline, replay/step, scenario runner, headless reproduction | A live session exports a scenario that passes headlessly; timeline manual QA |
| 5 | Capability manifests for two add-ons (one query, one command fallback), policy editor, audit view, retention | Public-data tests per add-on; audit rotation; policy change is visible and reversible |

Estimates in focused sessions: Phase 1 1-2, Phase 2 2-3, Phase 3 2-3, Phase 4
2-3, Phase 5 3-4. Calibration has n=1 for `python-daemon/v1` and no Q2DV
entries, so this is a judgement range based on the existing feature cadence
(one feature per release, roughly one focused session) and the host-bridge
phases. Re-estimate after Phase 1 with actuals recorded.

## 14. Risks and open questions

- **Scope:** Q2DV is `closing` and the WIP limit is 2. This plan should be the
  next milestone after the ChimeraX/demo close, not started in parallel.
- **Add-on maintenance:** manifests are only as good as their `tested_with`
  record; budget a re-probe when ChimeraX or an add-on updates.
- **Licensing and installation:** some add-ons list older ChimeraX bounds; test
  before promising an adapter.
- **Autonomy:** decide whether demo mode may auto-run network imports, or whether
  they stay `require-human` even in a demo.
- **Retention:** decided 2026-11-15 — 500 events, 100 MB, no time limit. Record
  actual usage against those numbers and compare later; surface the counters in
  the timeline footer.
- **Launching ChimeraX:** decided 2026-11-15 — `q2dv-mcp` may ask to launch the
  host, but only through an explicit consent prompt like an editor asking for
  folder access (scope: launch, read/write directory, network), revocable, and
  with the stray-instance check before and after.
- **Browser path:** stays human-only; a companion bridge is future work.
- **MCP client target:** OpenCode only, or a generic client contract.
- **Identity:** always record agent id and model in events and audit.

## 15. Agent readiness and autonomy ladder

Maturity is not global. Autonomy is earned **per feature** by instrumentation,
not granted by an app-wide milestone. The current matrix:

| Surface | Readiness | Evidence |
|---|---|---|
| analysis logic | high | 1,991 VM checks, ~1 s |
| state (tracks, claims, selection) | high | structured `parsedTracks`, `trackMeta` |
| events | partial | `logAction` is free text; needs `q2dv.event/1` |
| UI rendering and events | low | harness stubs the DOM |
| live ChimeraX | medium | bridge verified; full recipe QA pending |
| add-ons | none | no manifests yet |
| residue numbering | medium | mapping exists; edge cases unproven |
| replay and determinism | low | macros exist; no scenario assertions |
| prompt-injection resistance | untested | no fixtures yet |

A feature is **agent-ready** only when it has all five:

1. a pure-logic check in `tests/run.js`;
2. a field in `q2dv.snapshot/1`;
3. a `q2dv.event/1` with rationale and evidence;
4. a reversible action or an approval gate;
5. a manual QA card if it has a UI surface.

A feature missing 2-4 is **opaque**: the agent may read it but must propose
`require-human` for anything that depends on it. This is the rule that lets the
agent work side by side without waiting for full human QA.

Ladder:

| Level | Agent may | Gate |
|---|---|---|
| L0 Observe | read snapshots, run the harness, read logs | contracts only; no writes |
| L1 Propose | create decision cards | rationale/evidence schema |
| L2 Reversible actor | run agent-ready reversible recipes | instrumentation, Undo, audit |
| L3 Gated actor | run network/state-changing actions after a grant | consent token, policy |
| L4 Scenario autopilot | run a pinned scenario end to end | assertions + demo sandbox |

Start at L0/L1 immediately. Promote individual recipes to L2 as they pass the
five-point gate. L3 only with grants; L4 only inside a scenario with a passing
assertion set.

What this means for the current question: Q2DV is mature enough for a
**supervised co-tester** now (observe, propose, run instrumented reversible
recipes, step through every action), but not for unattended mutation or add-on
work. Human QA remains the release gate for UI surfaces; it is not a
prerequisite for the agent to observe or propose.

## 16. Decisions (2026-11-15)

1. Q2DV owns classification state now; note a possible ChimeraX MCP hand-off later.
2. Residue numbering must be confirmed and edge cases proven (mapping oracle).
3. Persistent actions get **Allow once / Allow for today / Always / Pause here**
   grants; agent activity shares the macro-recorder ledger for replay.
4. Host launch is allowed through an explicit, revocable consent prompt.
5. Timeline retention: 500 events, 100 MB, no time limit; keep metrics.
6. First adapters: MolCompose/PICKLUSTER structured plus one command-only add-on.
7. Target a **generic** MCP client contract (OpenCode, Claude, Codex).
8. Record agent id and model in every event and export.
9. Upstream text is data, never instructions; the harness gets injection fixtures.
10. Demo objective: Monday 2026-11-16; full ChimeraX usability of existing
    features, the MCP-assisted testing loop, and a human-led GFP/LacY review
    pack. Characterization is primary; drug development is the longer-term goal.
    Add binding-site, pocket, interface and ligand entities to the SSOT schema
    before claiming drug-development readiness.

## 17. Out of scope

- Replacing or wrapping ChimeraX MCPServer.
- Raw command or Python execution without a manifest or an allowlist entry.
- Automatic claim promotion or destructive edits.
- Sending private data to an external provider outside the Data Sources switch.
