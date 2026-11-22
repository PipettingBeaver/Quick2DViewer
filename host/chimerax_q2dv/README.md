# ChimeraX Q2DV host plugin

Canonical source for the ChimeraX side of Quick2DViewer. It embeds the
single-file Q2DV page, bridges selection/commands over QWebChannel, exposes the
host socket used by `q2dv-mcp`, and adds workspace, MaveDB, policy and add-on
manifest support.

## Layout

```text
bundle_info.xml          ChimeraX bundle metadata
src/__init__.py          BundleAPI / start_tool
src/tool.py              host bridge, socket, workspace, MaveDB, policy, adapters
src/workspace_store.py   current.json + backups + settings
src/html/qwebchannel.js  QWebChannel transport
src/html/index.html      generated from ../../index.html by build.sh
src/mavedb_provider.py   generated from ../../mcp/mavedb_provider.py by build.sh
```

`src/html/index.html` and `src/mavedb_provider.py` are generated; do not edit
them here.

## Build / sync

```bash
./build.sh
```

Then either:

- copy `src/` into an installed ChimeraX bundle
  (`.../site-packages/chimerax/q2dv_full/`) for a local test, or
- build a wheel with ChimeraX's Toolshed bundle builder using `bundle_info.xml`
  and `src/` as the inputs.

Restart ChimeraX after replacing `tool.py` or `workspace_store.py`; reopen the
Q2DV tool after replacing `html/index.html`.

## Environment

| Variable | Purpose |
|---|---|
| `Q2DV_FILES_DIR` | Workspace, datasets, agent socket, policy, status and profile root (default `~/Q2DV_files`). |
| `Q2DV_BUNDLE_DIR` | Preferred bundle directory (default `~/Q2DV_files/bundles`, or the local TerC bundle when present). |
| `Q2DV_PUBLIC_BUNDLE_DIR` / `_LACY_` | Public GFP/LacY bundle directories. |
| `Q2DV_REPO_ROOT` | Repository root used to find `mcp/` and public bundles when the plugin is not inside the repo. |
| `Q2DV_STATUS_FILE` / `Q2DV_WEB_PROFILE` | Diagnostic status file and WebEngine profile. |
| `Q2DV_AGENT_SOCKET` | Socket path used by the MCP client; must match the host. |

The plugin prefers `mavedb_provider` from its own package (the generated copy)
and falls back to `mcp/mavedb_provider.py` for development.

## Licensing note

This plugin runs inside ChimeraX. ChimeraX itself is licensed by UCSF for
non-commercial use; commercial use requires a separate UCSF license. The
plugin's own license is recorded at the repository root and does not change
ChimeraX's terms. See `../../LICENSE` when present and the UCSF ChimeraX
licensing page.
