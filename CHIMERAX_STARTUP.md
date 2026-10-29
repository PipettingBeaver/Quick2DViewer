# ChimeraX startup: CliX + Q2DV

**Scope:** general Q2DV + ChimeraX setup. This is a local user preference, not a
change to the public Q2DV app.

## Install once

1. Install **CliX** from the Toolshed:

```text
toolshed install ChimeraX-CliX
```

Or use **Tools > More Tools > CliX > Install**.

2. Install the Q2DV Full wheel, or the fallback Q2DV Bridge wheel.

3. Restart ChimeraX after installing bundles.

## Configure startup

Open **Favorites > Settings > Startup > Execute these commands at startup** and
paste:

```text
ui tool show clix
ui tool hide "command line interface"
ui tool show "Q2DV Full"
```

Order matters:

- Start CliX first. If CliX fails, the built-in command line remains available.
- Then hide the built-in command line.
- Then open the full Q2DV panel.

For the minimum-viable fallback, use:

```text
ui tool show clix
ui tool hide "command line interface"
ui tool show "Q2DV Bridge"
```

Do not load both `Q2DV Full` and `Q2DV Bridge` at startup. They are two hosts for
the same data and would duplicate the panel.

## If CliX is unavailable

If the CliX bundle is missing, the first startup command will fail. Keep the
built-in command line visible until CliX is installed. Recovery from CliX:

```text
ui tool show "command line interface"
```

## Alternative command-line launch

If startup settings are not available, launch with:

```text
chimerax --start "CliX" --start "Q2DV Full"
```

For the fallback:

```text
chimerax --start "CliX" --start "Q2DV Bridge"
```

Do not combine `--start` with the same tools in Startup settings; that can create
duplicate tool instances.

## Laptop notes

- Install CliX from the Toolshed before setting the startup commands.
- Set `Q2DV_BUNDLE_DIR` and `Q2DV_MODEL` before launch if paths differ.
- The full host needs the local bundle; the fallback needs the model.
- Keep the fallback wheel available in case the full page has a WebEngine issue.

## Current local state

- CliX 0.2.7 installed.
- Q2DV Full and Q2DV Bridge bundles installed.
- Startup commands set to CliX -> hide CLI -> Q2DV Full.
- Q2DV Full loopback server verified at startup.
