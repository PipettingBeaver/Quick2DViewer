# Cogni integration plan

**Status:** design, 2026-11-21. Target release/demo: **2026-12-01**.
**Related:** `MCP_AGENT_PLAN.md`, `AGENT_REFERENCE.md`, `mcp/README.md`,
`CHIMERAX_ADDON_AUDIT.md`.

## 1. What Cogni is

Cogni (https://getcogni.io/) is an MCP memory server. It stores facts and
observations as an entity graph, then serves **spreading-activation recall** over
that graph plus a normal dense-vector search. It runs no LLM and no GPU in the
retrieval path, so the client model does the reasoning and Cogni returns a small,
deterministic set of connected memories. It also supports point-in-time and
windowed recall.

Useful tools include `remember`, `recall`, `estimate_effort` and
`compare_effort`; the client model decides when to call them.

## 2. Decision

**Cogni is a memory layer, not a truth source.** Q2DV remains the source of truth
for sequences, tracks, evidence, decisions and vignettes. Cogni stores compact
records and returns prior context for a human to review.

For the Dec 1 demo, use the **agent-orchestrated** model:

```text
OpenCode / Claude Code / another MCP client
  ├── q2dv-mcp  (domain tools, evidence, vignettes, decisions)
  └── cogni     (remember / recall across sessions)
```

The agent calls Q2DV for evidence, asks Cogni to remember an accepted vignette,
and calls Cogni recall before drafting a new one. Q2DV does not need Cogni
credentials, and Cogni remains optional.

A direct `q2dv-mcp` → Cogni client is a later option. It would require MCP client
code, auth/token storage, network policy and failure handling; it is not needed
to demonstrate the workflow.

## 3. Memory record

New tool `q2dv.memory` (read-only) returns a compact, Cogni-ready record:

```json
{
  "schema": "q2dv.memory/1",
  "id": "mem-gfp-mavedb-81-85",
  "created_at": "2026-12-01T10:00:00Z",
  "app_version": "0.72.16",
  "host": "chimerax",
  "protein": { "label": "GFP", "bundle": "gfp-p42212-public", "sequence_sha256": "..." },
  "context": { "ranges": [[81, 85]], "selection": [[81, 85]], "structure": "1GFL/A" },
  "question": "Which GFP region is most sensitive to mutation?",
  "hypothesis": "Residues 81-85 carry the strongest combined mutational signal.",
  "evidence": [
    { "kind": "dataset", "id": "urn:mavedb:00000080-a-2", "title": "avGFP fluorescence" },
    { "kind": "track", "id": "MaveDB_combined_EXP" },
    { "kind": "structure", "id": "1GFL/A" }
  ],
  "analysis": { "method": "MaveDB combined score", "weights": { "coverage": 0.3, "effect": 0.4, "deleterious": 0.3 }, "top_clusters": [[81, 85, 0.61]] },
  "uncertainty": ["fluorescence assay, not stability", "sampling bias", "multi-substitution rows share a score"],
  "blind_spots": ["homology-only", "disorder", "isoforms/PTMs", "assay context", "epistasis"],
  "citations": [{ "id": "sarkisyan2016", "doi": "10.1038/nature17995" }],
  "review": { "status": "accepted", "reviewer": "human" }
}
```

Rules:

- Only accepted or explicitly reviewed vignettes are remembered by default.
- No raw structure text, lab file paths, credentials or full private sequences.
- Include the sequence hash, bundle id and exact residue ranges; never raw
  numbering without the mapping.
- A memory is a pointer to evidence, not evidence itself. A recalled memory is
  shown as prior context and the human decides whether to reuse it.

## 4. Lifecycle

1. **Observe:** Q2DV loads GFP/1GFL, runs MaveDB and the selected add-ons.
2. **Draft:** `q2dv_vignette` produces the evidence card.
3. **Review:** the human accepts, requests revision or rejects.
4. **Remember:** the Agent panel **Remember in Cogni** button copies the
   `q2dv.memory/1` payload; the agent sends it with Cogni `remember`.
5. **Recall:** a later session asks Cogni `recall` with the protein, ranges and
   question. The result is passed to `q2dv_vignette` as `prior_context`.
6. **Show:** the vignette card displays **Prior context** with source ids,
   dates and review status; the human can keep or dismiss it.
7. **Audit:** the Q2DV ledger records what was remembered and what was recalled;
   Cogni is not allowed to silently change a claim.

## 5. Work items

| Item | Change | Est. |
|---|---|---|
| Memory payload | `q2dv.memory` tool + reference entry + tests | 0.5 session |
| Remember button | Agent panel copies/returns the memory record; optional direct Cogni call by the agent | 0.5 |
| Prior-context input | `q2dv.vignette` accepts `prior_context`; card renders a Prior context block | 0.5 |
| Cogni setup | Register `cogni` in the MCP client; document login/token and scopes | 0.25 |
| Demo script | GFP accept → remember → new session → recall → vignette; LacY repeat | 0.5 |
| Safety pass | redaction, opt-in, failure fallback, prompt-injection fixtures | 0.5 |

Total: about 2–3 focused sessions. Calibration data is thin (n=1).

## 6. Demo outline (Dec 1)

1. Load GFP and 1GFL; run MaveDB and show the combined track.
2. Draft the vignette; show top clusters 81-85 and 63-67, checklist, citations.
3. Accept it; **Remember in Cogni**; show the memory JSON and the Cogni call.
4. Reset/clear input and reopen a fresh session.
5. Ask the agent to `recall` GFP mutation sensitivity; it returns the prior
   memory; draft a new vignette with **Prior context** and source/date.
6. Load LacY; show that the same workflow and memory are protein-agnostic.
7. Show the audit/ledger and the Q2DV evidence; Cogni only supplied context.

The demo is stronger if it shows **one uncertainty that the prior context
prevents repeating** and one that remains unresolved.

## 7. Safety and privacy

- Cogni is external: opt-in, like the external-services switch; no lab data by
  default.
- Redact file paths, usernames and unpublished sequences; prefer hashes.
- The MCP client holds the Cogni token; Q2DV never stores it.
- A recalled memory is untrusted text and data, never instructions.
- Cogni unavailable: Q2DV works normally; show "memory unavailable" rather than
  failing the vignette.
- Retention: a memory points to evidence that may have been pruned; mark stale
  pointers and do not fabricate the missing data.

## 8. Open questions

- Cogni account/auth: which login, token scope, and where the token lives in
  OpenCode.
- Memory scoping: per project, per protein, or per user. Default proposal:
  per Q2DV workspace + protein hash, with a visible `workspace` tag.
- Data residency and Cogni's retention policy for research data.
- Whether Cogni supports a remote MCP endpoint from the chosen client without a
  local bridge.
- Commercial use: Cogni terms and the separate UCSF ChimeraX non-commercial
  license both apply; confirm before presenting this as a commercial product.
