# Q2DV recipe model

**Status:** definition for the general Q2DV program; not a lab-specific document.  
**Decision:** a recipe is a **versioned, reviewable analysis protocol**, not a
command list, not a macro, and not a model.

## Definition

A recipe answers a specific question against a Q2DV context and produces one
reviewable observation, measurement, comparison, or export.

```text
recipe definition
  + context instance (model, chain, residue ranges, selection)
  + host binding (browser export / ChimeraX command / future MCP)
  = one reproducible action with provenance
```

A fixed toolbar button is an **instance** of a recipe. It is not the recipe
itself.

## What a recipe is not

| Not this | Why |
|---|---|
| A shell/Python command list | Commands are one host binding, not the protocol |
| A macro | A macro records what a user did; a recipe is reusable and reviewable |
| A workflow step | Workflow steps organize a scientific evaluation; recipes act on one context |
| A model or prediction | A recipe observes/measures; it does not generate biological truth |
| A hidden agent action | A human must review before execution |

## Required fields

```json
{
  "schema_version": "q2dv.recipe/1",
  "id": "q2dv.measure.metal-site",
  "version": "1.0.0",
  "title": "Measure the metal-site geometry",
  "category": "measure",
  "question": "Are the candidate metal ligands geometrically compatible?",
  "inputs": {
    "bundle_features": ["F:...:DN", "F:...:DXXXXXD"],
    "selection": "required",
    "model": "protein"
  },
  "context": {
    "ranges": "from Q2DV selection",
    "chain": "optional",
    "membrane": false
  },
  "parameters": {
    "max_distance": 3.0,
    "show_labels": true
  },
  "preconditions": [
    "a model is loaded",
    "at least one residue range is selected"
  ],
  "outputs": [
    "ChimeraX selection",
    "distance measurements",
    "PNG image",
    "log entry"
  ],
  "host_bindings": {
    "browser": {"format": "cxc"},
    "chimerax": {"command": "q2dv.measure.metal-site", "review": true}
  },
  "evidence": ["claim or feature IDs"],
  "safety": {
    "destructive": false,
    "allowlisted": true,
    "confirmation": false
  },
  "review": {
    "status": "proposed",
    "reviewer": "",
    "notes": ""
  }
}
```

## Categories

| Prefix | Purpose | Examples |
|---|---|---|
| `q2dv.map.*` | Map annotations onto the 3D model | secondary structure, TM, conservation, pLDDT |
| `q2dv.measure.*` | Measure geometry or chemistry | metal distances, contacts, buried area |
| `q2dv.compare.*` | Compare models or states | rank_001 vs rank_004, apo vs holo |
| `q2dv.inspect.*` | Inspect a region or feature | pore, L5, heme candidates |
| `q2dv.export.*` | Save a reproducible artifact | image, `.cxc`, measurements |

## Lifecycle

1. **Proposed:** a recipe definition with inputs, outputs and failure modes.
2. **Reviewed:** a human approves the command binding.
3. **Executed:** a host runs it against a context instance.
4. **Logged:** output and evidence IDs are recorded.
5. **Retired:** the recipe is superseded or fails QA.

Recipes are versioned independently from Q2DV. A Q2DV host declares the recipe
versions it supports.

## Naming and aliases

New IDs use the category form:

```text
q2dv.map.metal-site
q2dv.map.interface
q2dv.map.conservation
q2dv.measure.metal-site
q2dv.compare.models
q2dv.export.figure
```

The current short IDs remain **aliases** until the host adapters migrate:

| Current | New canonical |
|---|---|
| `q2dv-metal` | `q2dv.map.metal-site` |
| `q2dv-interface` | `q2dv.map.interface` |
| `q2dv-conservation` | `q2dv.map.conservation` |
| `q2dv-compare` | `q2dv.compare.models` |
| `q2dv-l5` | `q2dv.inspect.l5` |
| `q2dv-heme` | `q2dv.inspect.heme` |

Do not break the short IDs in the first migration. Resolve aliases to the
canonical recipe, log the canonical ID, and deprecate on a later version.

## Host bindings

| Host | Binding |
|---|---|
| Browser | Generate a downloadable `.cxc`; never execute |
| ChimeraX | QWebChannel calls an allowlisted Python slot; log command and result |
| Future MCP | Tool call with the same recipe ID and context contract; same review gate |

The host binding is not the recipe. The same `q2dv.map.metal-site` recipe can
produce a browser `.cxc` or a ChimeraX selection.

## Context contract

A recipe instance carries:

```json
{
  "source": "q2dv",
  "model": "rank_004",
  "chain": "A",
  "ranges": [[85, 86], [119, 119]],
  "length": 346,
  "claim_ids": ["PUB-METAL-DN-01"],
  "feature_ids": ["F:Q52356:DN"]
}
```

Ranges are **1-indexed inclusive**. Empty selections are invalid. The host must
validate ranges before running anything.

## Safety

- Allowlist recipe IDs.
- No arbitrary shell, Python, or ChimeraX command from the page.
- Destructive actions require explicit confirmation.
- Write paths must stay inside the configured output directory.
- Private bundles stay local.
- A recipe cannot silently promote a hypothesis to a validated result.

## Current contextual surface

The temporary fixed toolbar was removed because it duplicated controls Q2DV
already has. The first contextual integration uses the existing command panel:

- select a region, row, claim or feature in Q2DV;
- inspect the generated ChimeraX command;
- click **Run in ChimeraX**.

Future contextual recipe buttons should attach to existing claim, feature, BND
row and selection controls. They should not create a parallel toolbar.

## Migration order

1. Define the recipe schema and alias map.
2. Add a validator for recipe definitions.
3. Convert `recipes.json` to the new fields with old IDs as aliases.
4. Add host bindings for browser and ChimeraX.
5. Add contextual recipe buttons next to claims/features.
6. Retire the old short IDs only after both hosts use canonical IDs.

## What this changes

- A recipe is now a **scientific protocol with a question and failure modes**,
  not a command snippet.
- Commands are generated per host.
- The same recipe can be reviewed, versioned, tested, and reused.
- Q2DV can show which recipe is applicable to the current selection.
- The human review gate remains.
