# ChimeraX startup: CliX + Q2DV

**Scope:** general Q2DV + ChimeraX setup. This is a local user preference, not a
change to the public Q2DV app.

## Install once

1. Install **CliX** from the Toolshed:

```text
toolshed install ChimeraX-CliX
```

Or use **Tools > More Tools > CliX > Install**.

2. Install the Q2DV wheel.

3. Restart ChimeraX after installing bundles.

## Configure startup

Open **Favorites > Settings > Startup > Execute these commands at startup** and
paste:

```text
ui tool show clix
ui tool hide "command line interface"
ui tool show "Q2DV"
```

Order matters:

- Start CliX first. If CliX fails, the built-in command line remains available.
- Then hide the built-in command line.
- Then open the Q2DV panel.

The host injects the local bundle whose protein sequence matches the current
session. The local candidates are `TerC/bundle` (346 aa), `bundles/GFP/`
(238 aa, public example) and `bundles/LacY/` (417 aa, public membrane example).
A GFP session gets GFP; a LacY session gets LacY; no URL or reopen is needed.

The host watches the Q2DV sequence, so a bundle loaded after the tool opens is
switched automatically. Reopening the tool is not required.

Q2DV starts in a light or dark theme inferred from ChimeraX's Qt window
palette (the `theme=...` startup query). The header theme button can change it
after startup; the host query is only the initial value.

The host page is loaded from the pinned local `file://` copy, not a custom
`q2dvfull://` scheme. Qt requires custom schemes to be registered before the
QApplication exists, which a ChimeraX bundle cannot do. The file origin needs no
local port. The host workspace is the durable state store.

## File handoff

Q2DV copies attached/fetched structure files and imported or searched homolog
files into ChimeraX-visible paths:

```text
~/Q2DV_files/structures/
~/Q2DV_files/homologs/
```

Set `Q2DV_FILES_DIR` to move the vault. Options -> Local Structure Cache shows
the folder and an **Open in ChimeraX** button for each saved structure.

## Load GFP in ChimeraX

With a saved GFP session, Q2DV selects the GFP bundle and banks
`1GFL.pdb` and `1EMA.pdb`. If no atomic model is already open, it opens 1GFL
and shows chain A only. 1GFL has two chains in the asymmetric unit, but its
author biological unit is monomeric; chain B is hidden so the demo shows one
GFP molecule. 1EMA is a single-chain S65T reference.

Manual options:

```text
open 1gfl
open ~/Q2DV_files/structures/1GFL.pdb
open ~/Q2DV_files/structures/1EMA.pdb
```

Or use **File > Open** and choose one of those paths.

## If CliX is unavailable

If the CliX bundle is missing, the first startup command will fail. Keep the
built-in command line visible until CliX is installed. Recovery from CliX:

```text
ui tool show "command line interface"
```

## Alternative command-line launch

If startup settings are not available, launch with:

```text
chimerax --start "CliX" --start "Q2DV"
```

Do not combine `--start` with the same tools in Startup settings; that can create
duplicate tool instances.

## Laptop notes

- Install CliX from the Toolshed before setting the startup commands.
- Set `Q2DV_BUNDLE_DIR` and `Q2DV_MODEL` before launch if paths differ.
- The host needs the local bundle. The model can be opened in ChimeraX.

## Current local state

- CliX 0.2.7 installed.
- Q2DV bundle installed.
- Startup commands set to CliX -> hide CLI -> Q2DV.
- Q2DV custom-scheme host verified at startup; no local port.
