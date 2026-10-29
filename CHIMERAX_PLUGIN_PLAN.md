# Quick2DViewer + ChimeraX plugin plan

**Status:** Phase 1-3 plumbing verified; Q2DV 0.71.0. The full page loads, the bundle auto-loads as Q52356, the QWebChannel ping returns, selection context is wired, and Py3Dmol is disabled in the host. Full recipe/UI QA and membrane recipes remain.  
**Scope:** general Q2DV program, not lab-specific TerC data  
**Decision:** keep one Q2DV core with two hosts: browser and ChimeraX. Do not fork.

## 1. Product decision

Q2DV should be **ChimeraX-first for structural work**, but remain a standalone
browser viewer.

- The browser host is the public, dependency-free viewer.
- The ChimeraX host adds a docked Q2DV panel, local bundle loading, 3D
  selection, membrane context and reviewed command execution.
- Both hosts share the same core: bundle parser, tracks, claims, relations,
  features, residue ranges, recipe IDs and provenance.
- Host-specific UI appears only when a host adapter is present.
- A browser build must work unchanged when `window.Q2DVHost` is absent.

This avoids two forks drifting in schema, tests, bug fixes and feature
behaviour.

## 2. Architecture

```text
Q2DV core
  bundle / tracks / claims / relations / features / selection / recipes
        |
        +-- browser host
        |     file picker, URL loader, localStorage, Py3Dmol
        |
        +-- ChimeraX host
              local loopback bundle server, QWebChannel,
              membrane recipes, ChimeraX commands, image saving
```

### Host contract

```js
window.Q2DVHost = {
  kind: "browser" | "chimerax",
  capabilities: {
    openModel: true,
    runRecipe: true,
    saveImage: true,
    membrane: true,
    filePicker: true
  },
  loadBundle(pathOrUrl),
  runRecipe(recipeId, context),
  saveImage(path),
  notify(message)
};
```

The embedded page checks for this object. Without it, Q2DV behaves exactly as
the current browser app. The browser host can remain the reference
implementation.

## 3. Planned features

### P0 - integration foundation

| Feature | Browser | ChimeraX | Status |
|---|---|---|---|
| Load local bundle | folder picker / URL | loopback `/bundle/manifest.json` | prototyped |
| Claims/relations/features | yes | same UI | existing core |
| Residue selection | yes | sends context to ChimeraX | implemented via Send selection |
| Recipe execution | copy `.cxc` | allowlisted QWebChannel command | in progress |
| Save image | browser download | ChimeraX save | existing prototype |
| Public app unaffected | yes | optional host | requirement |
| Fallback panel | n/a | `Q2DV Bridge` | installed |
| Host badge | Standalone | ChimeraX | added in Q2DV 0.70.0 |

### P1 - ChimeraX structural workflow

| Feature | ChimeraX surface | Q2DV input |
|---|---|---|
| Metal-site geometry | `select`, `measure`, `hbonds`, `label` | metal-site feature/claim |
| Interface/L5 | `interfaces`, `measure buriedarea` | interface/claim residues |
| Pore/cavity | `volume`, `surface`, clipping | pore/region selection |
| Conservation/pLDDT | `color byattribute`, `defattr` | bundle/track values |
| Model comparison | `matchmaker`, `morph`, ChopChopMF compare | model/rank selection |
| Membrane-aware view | protein chain selection, lipid context | CHARMM-GUI model |
| Command log | ChimeraX Log | recipe provenance |
| Figure export | `label`, `2dlabels`, `save` | current selection |

### P2 - optional add-on layer

| Feature | Add-on / surface | Use |
|---|---|---|
| Interactive local LLM | Pellaeon + Ollama | natural-language command drafting |
| External agent control | ChimeraX MCP / third-party MCP | tool calls from Claude/Codex/Cursor |
| Model QA / batches | ChopChopMF 1.5 | PAE, pDockQ, ipSAE, Foldseek, JSON |
| Cryo-EM fitting | `fitmap`, ISOLDE | low-resolution map/model fitting |
| MD trajectory playback | `coordset` | GROMACS/NAMD output |
| Generated models | RFdiffusion/ColabFold | constrained hypothesis only |
| Public demo | GFP bundle | safe URL-loader showcase |

## 4. ChimeraX integration review

### Current platform status

- ChimeraX **1.12** is current on this machine (June 2026).
- It includes PyQt6 WebEngine, `HtmlToolInstance`, `HtmlView`, custom URL scheme
  registration and `QWebChannel`.
- HTML tools can call Python through a custom scheme; ChimeraX's own tutorial
  documents this.
- The official `mcp` bridge is present in the development tree but is
  **pre-alpha** and tied to 1.10dev; do not make it a production dependency yet.
- The Flatpak build has no offscreen renderer; image scripts use GUI mode. A
  native install may differ.

Key sources:

- HTML tool tutorial:
  <https://www.cgl.ucsf.edu/chimerax/docs/devel/tutorials/tutorial_tool_html.html>
- URL scheme manager:
  <https://www.cgl.ucsf.edu/chimerax/docs/devel/modules/scheme_mgr/scheme_mgr.html>
- Official MCP bridge:
  <https://github.com/RBVI/ChimeraX/tree/develop/src/bundles/mcp_server>

### Recommended embedding mechanics

1. Pin a copy of Q2DV in the ChimeraX bundle.
2. Serve it from a loopback-only HTTP server inside the bundle.
3. Serve the selected local bundle at `/bundle/`.
4. Use QWebChannel for selection/recipe calls.
5. Disable Q2DV's Py3Dmol panel in embedded mode; ChimeraX is the 3D view.
6. Keep the standalone browser page as the source of truth.

A custom-scheme-only bridge is possible, but loopback plus QWebChannel avoids
file URL, CORS and folder-picker edge cases.

## 5. Add-on review

| Add-on / surface | Status checked | Why it matters for Q2DV | Integration stance |
|---|---|---|---|
| **Pellaeon 0.2.13** | installed; Toolshed; MIT; ChimeraX 1.9+ | chat/tool calls inside ChimeraX; local Ollama or cloud; command audit | P1 interactive; not a dependency |
| **ChopChopMF 1.5** | Toolshed; updated 2026 | PAE/pDockQ/ipSAE/Foldseek/compare; JSON output; headless commands | strong P1/P2 candidate |
| **ISOLDE** | Toolshed; academic/nonprofit | flexible fitting to cryo-EM/crystallographic maps | P2 if a map exists |
| **ChimeraX MCP (official)** | develop branch; pre-alpha; 1.10dev | external agents control ChimeraX | watch; not production |
| **dovas-net/chimeraX-mcp** | local stdio; ~119 tools | broad external-agent surface | evaluate after official |
| **mahynotch/chimerax-mcp** | PyPI; early | simple MCP install | evaluate on public data |
| **N283T/chimerax-mcp-plus** | small project | API search/recipes/screenshots | evaluate |
| **ChatMol MCP servers** | PyMOL/ChimeraX + databases/NIM | external agent plus UniProt/PDB/PubMed | later; broad surface |
| **ChimeraLLM (AminN77)** | GUI add-on | OpenAI-compatible/Copilot chat | optional; GUI-only |
| **Py3Dmol / 3Dmol** | browser only | Q2DV 3D view | disable in ChimeraX host |

No formal peer-reviewed comparison of these LLM integrations exists. Treat them
as engineering tools with different maturity, licensing and data-retention
terms.

### Literature and documentation notes

- ChimeraX: Goddard et al., *Protein Science* 2018; Pettersen et al., *Protein
  Science* 2021. Cite the current ChimeraX release for methods.
- ISOLDE: Croll, *Acta Crystallographica D* 2018.
- Pellaeon: Zenodo DOI `10.5281/zenodo.23395411`.
- ChopChopMF: Toolshed documentation and project guide.
- Official MCP bridge: RBVI development source; pre-alpha.
- Third-party MCP servers: GitHub projects; verify maintenance, license and
  security before installation.

## 6. ChimeraX-first UX

The ChimeraX panel should prioritize:

1. Large docked Q2DV view.
2. Automatic local bundle load.
3. Claims/features with **Send to ChimeraX**.
4. Model/chain selector.
5. Recipe palette (metal, interface, pore, conservation, pLDDT, compare).
6. Membrane-aware actions.
7. One-click image/`.cxc` save.
8. Clear log with recipe and evidence IDs.

Hide browser-only controls in the ChimeraX panel:

- folder picker (use ChimeraX/Qt dialog or loopback bundle);
- Py3Dmol panel;
- browser download as primary save;
- URL loader as primary bundle path.

Keep them available in the browser host. Do not remove browser features just
because the ChimeraX host does not use them.

## 7. Implementation phases

### Phase 0 - fallback panel (done)

`Q2DV Bridge` docked panel with allowlisted recipes. This is the minimum viable
integration and remains the fallback.

### Phase 1 - full Q2DV page (in progress)

- Pinned Q2DV HTML is in the bundle.
- Loopback server verified: `/q2dv/index.html` and `/bundle/manifest.json` return HTTP 200.
- Full-page visual inspection and CSP/console checks are pending.
- Py3Dmol disablement is pending.
- Acceptance: full UI, no CSP errors, no external upload.

### Phase 2 - automatic bundle + host contract

- ChimeraX/Qt bundle folder chooser.
- Serve `/bundle/`.
- Auto-load `/bundle/manifest.json`.
- Add `window.Q2DVHost` capability checks.
- Acceptance: claims/features appear without a browser folder picker.

### Phase 3 - QWebChannel recipes

- Selection context: model, chain, residue ranges, claim/feature IDs.
- Allowlisted recipes only.
- Log command, save `.cxc`, save image.
- Acceptance: claim -> 3D selection; metal/interface recipes work.

### Phase 4 - membrane recipes

- Identify protein chains in CHARMM-GUI systems.
- Style protein only, leave lipids/ions visible.
- Add metal, interface, heme, pore, save recipes.
- Acceptance: membrane image with correct residue numbering.

### Phase 5 - addon integrations

- ChopChopMF JSON for QA/interface scores.
- Pellaeon for chat; optional MCP for external agents.
- ISOLDE/fitmap only when a map exists.
- `coordset` for trajectories.
- Acceptance: each add-on has a public-data demo and a fallback.

## 8. Testing and acceptance

- Core: existing `npm test`.
- Host contract: browser stub and ChimeraX stub.
- Browser smoke: file/URL bundle, claims, 3Dmol.
- ChimeraX smoke: full page, auto bundle, recipe, membrane, image.
- Compatibility: `APP_VERSION` vs bundle-pinned version.
- Offline: local bundle workflow without external APIs.
- Security: unknown recipe rejected; no arbitrary Python/shell.
- Regression: standalone browser unaffected.

## 9. Risks

| Risk | Mitigation |
|---|---|
| CSP/WebEngine asset failures | same-origin loopback; no CDN; disable Py3Dmol |
| Folder picker limitations | Qt dialog + `/bundle/` server |
| Docked panel too small | large tab/window; responsive layout |
| Q2DV changes break host | pinned version + compatibility check |
| Add-on maturity | fallback path; public-data tests |
| LLM privacy | local Ollama; explicit review; no auto-run |
| Two-host drift | one core; host adapter; shared tests |
| Plugin displaces science | keep the MD/triage work as the primary task |

## 10. Startup configuration

Install CliX and set these under **Favorites -> Settings -> Startup -> Execute
these commands at startup**:

```text
ui tool show clix
ui tool hide "command line interface"
ui tool show "Q2DV Full"
```

For the fallback panel, replace the last line with `ui tool show "Q2DV Bridge"`.
See `CHIMERAX_STARTUP.md` for laptop and recovery notes. Do not load both Q2DV
hosts at once.

## 11. Decision summary

**ChimeraX-first product direction, browser-compatible core, one codebase, two
thin hosts.**

Build the full embed and QWebChannel bridge first. Add ChopChopMF/Pellaeon/MCP
only after the core selection-and-recipe loop is stable.

Do not:

- maintain two `index.html` copies by hand;
- make the browser app require ChimeraX;
- replace ChimeraX's 3D view with Py3Dmol;
- allow the embedded page to execute arbitrary commands;
- upload private bundles or lab data.
