# Agent tool reference

Generated from `AGENT_TOOLS` in `index.html` by `npm run agent:tools`.
Do not edit by hand.

| Tool | Tier | Approval | Effects | Input |
|---|---|---|---|---|
| `q2dv.status` | agent-run | agent | read-only | - |
| `q2dv.snapshot` | agent-run | agent | read-only | track_limit |
| `q2dv.list_tracks` | agent-run | agent | read-only | limit, offset |
| `q2dv.read_track` | agent-run | agent | read-only | track, start, end, max |
| `q2dv.describe` | agent-run | agent | read-only | - |
| `q2dv.host_capabilities` | agent-run | agent | read-only | - |
| `q2dv.command` | require-human | human | writes files | command |
| `q2dv.select` | agent-run | agent | state change | ranges |
| `q2dv.import` | require-human | human | network, changes sequence | kind, sequence, fasta, pdb, label |
| `q2dv.run` | agent-run | agent | read-only | recipe, track, structure |
| `q2dv.mavedb` | require-human | human | network, writes files | urn, weights, window, min_variants, threshold, refresh, cache_only |
| `q2dv.vignette` | agent-run | agent | read-only | question, notes |
| `q2dv.backup` | agent-run | agent | state change | - |
| `q2dv.clear_input` | require-human | human | changes sequence | - |
| `q2dv.restore` | require-human | human | changes sequence | - |
| `q2dv.literature` | agent-run | agent | read-only | topic |
| `q2dv.reference` | agent-run | agent | read-only | - |
| `q2dv.policy` | agent-run | agent | read-only | - |
| `q2dv.addon` | require-human | human | state change | id, action, args |
| `q2dv.propose` | agent-run | agent | read-only | tool, tier, title, why, expected, args |
| `q2dv.decide` | agent-run | agent | state change | id, approve, token |
| `q2dv.ledger` | agent-run | agent | read-only | limit, since_seq |

Human documentation: `mcp/README.md` and `MCP_AGENT_PLAN.md`.
