# Expanded prototype: serve the pinned Q2DV page on loopback and embed it.
import json
import os
import pathlib
import re
import shutil
import sys
import time
import uuid
from difflib import SequenceMatcher

from .workspace_store import WorkspaceStore, DEFAULT_WINDOW, MIN_WINDOW

from chimerax.ui import HtmlToolInstance
from chimerax.core.commands import run
from Qt.QtCore import QTimer, QObject, Slot, QUrl
# The ChimeraX Qt shim does not expose QtWebChannel; import PyQt6 directly.
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings
from PyQt6.QtNetwork import QLocalServer


HTML_DIR = pathlib.Path(__file__).resolve().parent / "html"
FILES_DIR = pathlib.Path(os.environ.get("Q2DV_FILES_DIR", str(pathlib.Path.home() / "Q2DV_files")))
_LEGACY_BUNDLE = pathlib.Path("/home/tan/PipettingBeaver_Github/Quick2DViewer/TerC/bundle")
_DEFAULT_BUNDLE = _LEGACY_BUNDLE if _LEGACY_BUNDLE.is_dir() else (FILES_DIR / "bundles")
BUNDLE_DIR = pathlib.Path(os.environ.get("Q2DV_BUNDLE_DIR", str(_DEFAULT_BUNDLE)))
_ENV_REPO = os.environ.get("Q2DV_REPO_ROOT")
_REPO_ROOT = pathlib.Path(_ENV_REPO) if _ENV_REPO else BUNDLE_DIR.parent.parent
PUBLIC_BUNDLE_DIR = pathlib.Path(os.environ.get(
    "Q2DV_PUBLIC_BUNDLE_DIR",
    str(_REPO_ROOT / "bundles" / "GFP"),
))
PUBLIC_LACY_BUNDLE_DIR = pathlib.Path(os.environ.get(
    "Q2DV_PUBLIC_LACY_BUNDLE_DIR",
    str(_REPO_ROOT / "bundles" / "LacY"),
))
BUNDLE_CANDIDATES = [BUNDLE_DIR, PUBLIC_BUNDLE_DIR, PUBLIC_LACY_BUNDLE_DIR]
STATUS_FILE = pathlib.Path(os.environ.get("Q2DV_STATUS_FILE", str(FILES_DIR / "q2dv_full_status.txt")))
PROFILE_DIR = pathlib.Path(os.environ.get("Q2DV_WEB_PROFILE", str(FILES_DIR / "webprofile")))
_MCP_DIR = _REPO_ROOT / "mcp"
if str(_MCP_DIR) not in sys.path:
    sys.path.insert(0, str(_MCP_DIR))
try:
    from .mavedb_provider import analyze_mavedb
except Exception:
    try:
        from mavedb_provider import analyze_mavedb
    except Exception:
        analyze_mavedb = None
def detect_ui_theme():
    try:
        from PyQt6.QtWidgets import QApplication
        app = QApplication.instance()
        if app is None:
            return "light"
        try:
            scheme = app.styleHints().colorScheme()
            name = str(scheme).lower()
            if "dark" in name:
                return "dark"
            if "light" in name:
                return "light"
        except Exception:
            pass
        color = app.palette().window().color()
        return "dark" if color.lightness() < 128 else "light"
    except Exception:
        return "light"

FILE_KINDS = {"structures", "homologs"}
AA3_TO_ONE = {
    "ALA":"A","ARG":"R","ASN":"N","ASP":"D","CYS":"C","GLN":"Q","GLU":"E","GLY":"G",
    "HIS":"H","ILE":"I","LEU":"L","LYS":"K","MET":"M","PHE":"F","PRO":"P","SER":"S",
    "THR":"T","TRP":"W","TYR":"Y","VAL":"V","MSE":"M","SEC":"U","PYL":"O",
}
MAX_ASA = {
    "ALA":129.0,"ARG":274.0,"ASN":195.0,"ASP":193.0,"CYS":167.0,"GLN":225.0,
    "GLU":223.0,"GLY":104.0,"HIS":224.0,"ILE":197.0,"LEU":201.0,"LYS":236.0,
    "MET":224.0,"PHE":240.0,"PRO":159.0,"SER":155.0,"THR":172.0,"TRP":285.0,
    "TYR":263.0,"VAL":174.0,"MSE":224.0,
}

class _Q2DVBridge(QObject):
    def __init__(self, tool):
        super().__init__()
        self.tool = tool

    @Slot(result=str)
    def ping(self):
        return "pong"

    @Slot(str, result=str)
    def runCommand(self, command):
        return self.tool.run_command(command)

    @Slot(str, str, str, result=str)
    def saveFile(self, kind, name, text):
        return self.tool.save_file(kind, name, text)

    @Slot(str, str, result=str)
    def selectResidues(self, ranges_json, sequence):
        return self.tool.select_residues(ranges_json, sequence)

    @Slot(str, result=str)
    def openFile(self, path):
        return self.tool.open_file(path)

    @Slot(result=str)
    def filesDir(self):
        return str(FILES_DIR)

    @Slot(str, result=str)
    def saveWorkspace(self, text):
        return self.tool.save_workspace(text)

    @Slot(result=str)
    def loadWorkspace(self):
        return self.tool.load_workspace()

    @Slot(str, result=str)
    def saveHostSettings(self, text):
        return self.tool.save_host_settings(text)

    @Slot(result=str)
    def getHostSettings(self):
        return json.dumps(self.tool._settings, ensure_ascii=False)

    @Slot(str, str, result=str)
    def offload(self, name, payload):
        return self.tool.offload(name, payload)

    @Slot(result=str)
    def getModelContext(self):
        return self.tool.model_context()

    @Slot(str, result=str)
    def setSelectionLinkMode(self, mode):
        return self.tool.set_selection_link_mode(mode)

    @Slot(result=str)
    def viewportInfo(self):
        return self.tool.viewport_info()

    @Slot(str, str)
    def agentResult(self, request_id, result_json):
        self.tool.agent_result(str(request_id), str(result_json))

    @Slot(str, result=str)
    def runAgentCommand(self, command):
        return self.tool.run_agent_command(command)

    @Slot(result=str)
    def getCapabilities(self):
        return self.tool.agent_capabilities()

    @Slot(str, result=str)
    def mavedbAnalysis(self, payload):
        return self.tool.mavedb_analysis(payload)

    @Slot(result=str)
    def clearWorkspace(self):
        return self.tool.clear_workspace()

    @Slot(result=str)
    def restoreWorkspace(self):
        return self.tool.restore_workspace()

    @Slot(result=str)
    def latestBackup(self):
        return self.tool.latest_backup()

    @Slot(str, result=str)
    def literature(self, payload):
        return self.tool.literature(payload)

    @Slot(str, result=str)
    def savePolicy(self, text):
        return self.tool.save_policy(text)

    @Slot(result=str)
    def loadPolicy(self):
        return self.tool.load_policy()

    @Slot(result=str)
    def addonManifests(self):
        return self.tool.addon_manifests()


class Q2DVFullTool(HtmlToolInstance):
    SESSION_ENDURING = False
    SESSION_SAVE = False
    AGENT_COMMAND_PREFIXES = (
        "select ", "color ", "label ", "contacts ", "clashes ", "hbonds ", "setattr ",
        "save ", "view ", "lighting ", "measure ", "distance ", "angle ", "torsion ",
        "show ", "hide ", "cartoon ", "style ", "surface ", "matchmaker ", "align ",
        "rmsd ", "info ", "help ",
    )

    def __init__(self, session, tool_name):
        self._ui_theme = detect_ui_theme()
        self._workspace = WorkspaceStore(FILES_DIR)
        self._settings = self._workspace.load_settings()
        self._q2dv_seq = ""
        self._selection_link_mode = str(self._settings.get("selection_link_mode") or "both")
        if self._selection_link_mode not in ("both", "to-host", "to-page", "off"):
            self._selection_link_mode = "both"
        self._last_host_selection_key = ""
        self._selection_echo_until = 0.0
        window = self._settings.get("window") if isinstance(self._settings.get("window"), dict) else {}
        width = max(MIN_WINDOW[0], int(window.get("width", DEFAULT_WINDOW[0])))
        height = max(MIN_WINDOW[1], int(window.get("height", DEFAULT_WINDOW[1])))
        self._url = QUrl.fromLocalFile(str(HTML_DIR / "index.html"))
        self._url.setQuery("host=chimerax&theme=" + self._ui_theme)
        super().__init__(session, tool_name, size_hint=(width, height), log_errors=True)
        self.display_name = "Q2DV"
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        FILES_DIR.mkdir(parents=True, exist_ok=True)
        self._profile = QWebEngineProfile("q2dv-chimerax", self.html_view)
        self._profile.setPersistentStoragePath(str(PROFILE_DIR))
        self._profile.setCachePath(str(PROFILE_DIR / "cache"))
        self._profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.ForcePersistentCookies)
        self._page = QWebEnginePage(self._profile, self.html_view)
        self.html_view.setPage(self._page)
        settings = self._page.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        self._bridge = _Q2DVBridge(self)
        self._channel = QWebChannel(self._page)
        self._channel.registerObject("q2dvHost", self._bridge)
        self._page.setWebChannel(self._channel)
        self._agent_server = None
        self._agent_sockets = []
        self._agent_buffers = {}
        self._agent_pending = {}
        self._agent_timers = {}
        self._agent_requests = {}
        self._status("init: channel registered; origin=%s; theme=%s; window=%dx%d" % (self._url.toString(), self._ui_theme, width, height))
        self._page.loadFinished.connect(self._loaded)
        self.session.logger.info("Q2DV: loading %s" % self._url)
        self._page.setUrl(self._url)

    def _status(self, message):
        try:
            with STATUS_FILE.open("a") as fh:
                fh.write(message + "\n")
        except Exception:
            pass

    def _loaded(self, ok):
        self.session.logger.info("Q2DV: page loaded=%s" % ok)
        self._status("page loaded=%s" % ok)
        if not ok:
            return
        self._inject_bridge()
        QTimer.singleShot(1200, self._start_agent_server)
        QTimer.singleShot(6000, self._check_bridge)
        QTimer.singleShot(8000, self._check_runtime)
        if os.environ.get("Q2DV_TEST_FETCH") == "1":
            fetch_js = "window.__q2dvFetchTest='pending'; fetch('https://rest.uniprot.org/uniprotkb/Q52356.json',{cache:'no-store'}).then(r=>window.__q2dvFetchTest='HTTP '+r.status).catch(e=>window.__q2dvFetchTest='ERR '+e.message);"
            self._page.runJavaScript(fetch_js)
            QTimer.singleShot(12000, self._check_fetch)
        if os.environ.get("Q2DV_TEST_STORAGE") == "1":
            self._page.runJavaScript("localStorage.setItem('q2dViewer_welcome_v1','persisted-test');")
        self._load_bundle()
        self._bundle_timer = QTimer(self.html_view)
        self._bundle_timer.setInterval(1000)
        self._bundle_timer.timeout.connect(self._check_bundle_state)
        self._bundle_timer.start()
        QTimer.singleShot(800, self._check_bundle_state)
        self._selection_timer = QTimer(self.html_view)
        self._selection_timer.setInterval(700)
        self._selection_timer.timeout.connect(self._check_host_selection)
        self._selection_timer.start()
        test_seq = os.environ.get("Q2DV_TEST_SEQUENCE")
        if test_seq:
            test_seq_js = json.dumps(test_seq)
            def set_test_sequence():
                self._page.runJavaScript(
                    "parsedTracks.AA = " + test_seq_js + ";"
                    "if (typeof currentProteinLabel !== 'undefined') currentProteinLabel = 'GFP';"
                    "if (typeof renderViewer === 'function') renderViewer(parsedTracks);"
                )
            QTimer.singleShot(9000, set_test_sequence)

    def _inject_bridge(self):
        js_file = HTML_DIR / "qwebchannel.js"
        if not js_file.is_file():
            self.session.logger.error("Q2DV: missing qwebchannel.js")
            return
        js = js_file.read_text()
        self.html_view.page().runJavaScript(js)
        bootstrap = r"""
(function () {
  if (typeof qt === 'undefined' || !qt.webChannelTransport) {
    console.warn('Q2DV: QWebChannel transport unavailable');
    return;
  }
  new QWebChannel(qt.webChannelTransport, function (channel) {
    const bridge = channel.objects.q2dvHost;
    window.q2dvChimeraX = bridge;
    window.Q2DVHost = {
      kind: 'chimerax',
      capabilities: {
        runCommand: true, saveFile: true, openFile: true, selectResidues: true,
        workspace: true, offload: {
          structureParse: false, rsa: true, interface: false,
          validation: false, figures: false
        }
      },
      runCommand: function (command) { return bridge.runCommand(command); },
      saveFile: function (kind, name, text) { return bridge.saveFile(kind, name, text); },
      openFile: function (path) { return bridge.openFile(path); },
      filesDir: function () { return bridge.filesDir(); },
      selectResidues: function (ranges, sequence) { return bridge.selectResidues(JSON.stringify(ranges), sequence); },
      saveWorkspace: function (text) { return bridge.saveWorkspace(text); },
      loadWorkspace: function () { return bridge.loadWorkspace(); },
      saveHostSettings: function (text) { return bridge.saveHostSettings(text); },
      getHostSettings: function () { return bridge.getHostSettings(); },
      offload: function (name, payload) { return bridge.offload(name, payload); },
      getModelContext: function () { return bridge.getModelContext(); },
      setSelectionLinkMode: function (mode) { return bridge.setSelectionLinkMode(mode); },
      viewportInfo: function () { return bridge.viewportInfo(); },
      runAgentCommand: function (command) { return bridge.runAgentCommand(command); },
      getCapabilities: function () { return bridge.getCapabilities(); },
      mavedbAnalysis: function (payload) { return bridge.mavedbAnalysis(payload); },
      clearWorkspace: function () { return bridge.clearWorkspace(); },
      restoreWorkspace: function () { return bridge.restoreWorkspace(); },
      latestBackup: function () { return bridge.latestBackup(); },
      literature: function (payload) { return bridge.literature(payload); },
      savePolicy: function (text) { return bridge.savePolicy(text); },
      loadPolicy: function () { return bridge.loadPolicy(); },
      addonManifests: function () { return bridge.addonManifests(); }
    };
    window.__q2dvAgentCall = function (requestId, requestJson) {
      let request;
      try { request = JSON.parse(requestJson); }
      catch (err) {
        bridge.agentResult(requestId, JSON.stringify({
          schema: 'q2dv.agent.result/1', status: 'error',
          error: { code: 'validation', message: 'Invalid request JSON' }
        }));
        return;
      }
      Promise.resolve(window.q2dvAgentRequest(request)).then(function (result) {
        bridge.agentResult(requestId, JSON.stringify(result));
      }).catch(function (err) {
        bridge.agentResult(requestId, JSON.stringify({
          schema: 'q2dv.agent.result/1', status: 'error',
          error: { code: 'internal', message: String((err && err.message) || err) }
        }));
      });
    };
    if (typeof syncQ2DVHostBadge === 'function') syncQ2DVHostBadge();
    window.__q2dvBridgeReady = true;
    bridge.ping(function (result) { window.__q2dvBridgePing = result; });
  });
})();
"""
        self.html_view.page().runJavaScript(bootstrap, self._bridge_result)

    def _bridge_result(self, result):
        self.session.logger.info("Q2DV: bridge bootstrap=%r" % (result,))
        self._status("bridge bootstrap=%r" % (result,))

    def _check_bridge(self):
        js = "String(window.__q2dvBridgeReady === true) + '|' + String(window.__q2dvBridgePing || '');"
        self.html_view.page().runJavaScript(js, self._bridge_status)

    def _bridge_status(self, result):
        self.session.logger.info("Q2DV: bridge status=%r" % (result,))
        self._status("bridge status=%r" % (result,))

    def _check_runtime(self):
        js = "String(typeof externalServicesEnabled !== 'undefined' ? externalServicesEnabled : 'missing') + '|' + location.origin + '|' + String(localStorage.getItem('q2dViewer_welcome_v1'));"
        self._page.runJavaScript(js, self._runtime_status)

    def _runtime_status(self, result):
        self.session.logger.info("Q2DV: runtime status=%r" % (result,))
        self._status("runtime=%r" % (result,))

    def _check_fetch(self):
        self._page.runJavaScript("String(window.__q2dvFetchTest || 'missing')", self._fetch_status)

    def _fetch_status(self, result):
        self.session.logger.info("Q2DV: fetch test=%r" % (result,))
        self._status("fetch test=%r" % (result,))

    def select_residues(self, ranges_json, sequence, attempts=0):
        self._selection_request_id = getattr(self, "_selection_request_id", 0) + 1
        token = self._selection_request_id
        try:
            ranges = json.loads(ranges_json)
            if not isinstance(ranges, list):
                raise ValueError("ranges must be a list")
            ref = re.sub(r"\s+", "", str(sequence or "")).upper()
            if not ref:
                return "error: no reference sequence"
            clean = []
            for pair in ranges:
                if not isinstance(pair, list) or len(pair) != 2:
                    raise ValueError("bad range")
                start, end = int(pair[0]), int(pair[1])
                if start < 1 or end < start or end > len(ref):
                    raise ValueError("range outside sequence")
                clean.append((start, end))
            if not clean:
                run(self.session, "select clear")
                return "cleared"
            best = None
            requested = sum(end - start + 1 for start, end in clean)
            for model in self.session.models.list():
                if not hasattr(model, "chains"):
                    continue
                for chain in model.chains:
                    residues = [r for r in chain.residues if r is not None and str(r.name).upper() in AA3_TO_ONE]
                    if len(residues) < 2:
                        continue
                    seq = "".join(AA3_TO_ONE.get(str(r.name).upper(), "X") for r in residues)
                    matcher = SequenceMatcher(None, ref, seq, autojunk=False)
                    blocks = matcher.get_matching_blocks()
                    mapping = [None] * len(ref)
                    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                        if tag == "equal":
                            for k in range(i2 - i1):
                                mapping[i1 + k] = residues[j1 + k]
                        elif tag == "replace":
                            rlen, slen = i2 - i1, j2 - j1
                            if rlen <= 0 or slen <= 0:
                                continue
                            for k in range(rlen):
                                mapping[i1 + k] = residues[j1 + min(slen - 1, int(k * slen / rlen))]
                    mapped = []
                    for start, end in clean:
                        for pos in range(start - 1, end):
                            res = mapping[pos]
                            if res is not None:
                                mapped.append(res)
                    if not mapped:
                        continue
                    identity = sum(b.size for b in blocks) / max(len(ref), len(seq), 1)
                    coverage = len(mapped) / max(requested, 1)
                    candidate = (coverage, identity, model, chain, mapped)
                    if best is None or candidate[:2] > best[:2]:
                        best = candidate
            if best is None:
                has_model = any(hasattr(m, "residues") for m in self.session.models.list())
                self._status("selection no matching chain for %d aa (model=%s)" % (len(ref), has_model))
                if not has_model and attempts < 3:
                    # Startup race: a restored workspace can request a selection
                    # before the host has opened (or the user has opened) a model.
                    QTimer.singleShot(1200, lambda: self._retry_selection(token, ranges_json, sequence, attempts + 1))
                    self._status("selection deferred: waiting for a model (retry %d)" % (attempts + 1))
                    return "pending: no atomic model"
                return "error: no atomic model" if not has_model else "error: no matching model/chain"
            coverage, identity, model, chain, mapped = best
            nums = []
            for res in mapped:
                number = str(res.number)
                ins = str(res.insertion_code or "").strip()
                nums.append(number + ins)
            target = "#%s/%s:%s" % (model.id_string, chain.chain_id, ",".join(nums))
            run(self.session, "select " + target)
            self._last_host_selection_key = json.dumps([[s, e] for s, e in clean])
            self._selection_echo_until = time.monotonic() + 1.0
            self._status("selection %s (coverage %.3f, identity %.3f)" % (target, coverage, identity))
            return "ok: " + target
        except Exception as exc:
            self._status("selection failed: %s" % exc)
            return "error: " + str(exc)

    def _retry_selection(self, token, ranges_json, sequence, attempts):
        if token != getattr(self, "_selection_request_id", 0):
            return
        self.select_residues(ranges_json, sequence, attempts)

    def save_file(self, kind, name, text):
        kind = str(kind or "").strip().lower()
        if kind not in FILE_KINDS:
            return "error: unsupported file kind"
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", pathlib.Path(str(name or "file")).name).strip("._")
        if not safe_name:
            return "error: empty file name"
        raw = str(text or "").encode("utf-8")
        if len(raw) > 100 * 1024 * 1024:
            return "error: file too large"
        target = FILES_DIR / kind / safe_name
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(target.name + ".tmp")
            tmp.write_bytes(raw)
            tmp.replace(target)
            self._status("saved %s/%s (%d bytes)" % (kind, safe_name, len(raw)))
            return str(target)
        except Exception as exc:
            self._status("save failed %s: %s" % (safe_name, exc))
            return "error: " + str(exc)

    def open_file(self, path):
        target = pathlib.Path(str(path or "")).resolve()
        root = FILES_DIR.resolve()
        if not (target == root or root in target.parents):
            return "error: path outside Q2DV files"
        if not target.is_file():
            return "error: file not found"
        command = 'open "' + str(target).replace('"', '\\"') + '"'
        run(self.session, command)
        self._status("opened %s" % target)
        return "ok"

    def save_workspace(self, text):
        try:
            path = self._workspace.save_workspace(text)
            self._status("workspace saved=%s" % path)
            return path
        except Exception as exc:
            self._status("workspace save failed: %s" % exc)
            return "error: " + str(exc)

    def load_workspace(self):
        text = self._workspace.load_workspace()
        if text:
            self._status("workspace loaded=%s" % self._workspace.current)
        return text

    def save_host_settings(self, text):
        try:
            patch = json.loads(str(text or "{}"))
            if not isinstance(patch, dict):
                return "error: settings must be an object"
            merged = dict(self._settings)
            merged.update(patch)
            self._settings = merged
            self._workspace.save_settings(merged)
            self._status("host settings saved=%s" % self._workspace.settings)
            return "ok"
        except Exception as exc:
            self._status("host settings save failed: %s" % exc)
            return "error: " + str(exc)

    def offload(self, name, payload):
        if name == "rsa":
            return self._offload_rsa(payload)
        if name in {"structureParse", "interface", "validation", "figures"}:
            self._status("offload %s requested, not implemented" % name)
            return "unsupported: " + name
        return "error: unknown offload"

    def _offload_rsa(self, payload):
        try:
            data = json.loads(payload or "{}")
            ref = re.sub(r"\s+", "", str(data.get("sequence") or "")).upper()
            if not ref:
                return "error: no reference sequence"
            best = None
            for model in self.session.models.list():
                if not hasattr(model, "chains"):
                    continue
                for chain in model.chains:
                    residues = [r for r in chain.residues if r is not None and str(r.name).upper() in AA3_TO_ONE]
                    if len(residues) < 2:
                        continue
                    seq = "".join(AA3_TO_ONE.get(str(r.name).upper(), "X") for r in residues)
                    matcher = SequenceMatcher(None, ref, seq, autojunk=False)
                    mapping = [None] * len(ref)
                    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                        if tag == "equal":
                            for k in range(i2 - i1):
                                mapping[i1 + k] = residues[j1 + k]
                        elif tag == "replace":
                            rlen, slen = i2 - i1, j2 - j1
                            if rlen > 0 and slen > 0:
                                for k in range(rlen):
                                    mapping[i1 + k] = residues[j1 + min(slen - 1, int(k * slen / rlen))]
                    mapped = [r for r in mapping if r is not None]
                    if not mapped:
                        continue
                    identity = sum(b.size for b in matcher.get_matching_blocks()) / max(len(ref), len(seq), 1)
                    coverage = len(mapped) / max(len(ref), 1)
                    if best is None or (coverage, identity) > best[:2]:
                        best = (coverage, identity, model, chain, mapping)
            if best is None:
                return "error: no atomic model"
            coverage, identity, model, chain, mapping = best
            target = "#%s/%s" % (model.id_string, chain.chain_id)
            run(self.session, "measure sasa %s & protein setAttribute true" % target)
            values = [None] * len(ref)
            for i, res in enumerate(mapping):
                if res is None:
                    continue
                area = getattr(res, "area", None)
                max_area = MAX_ASA.get(str(res.name).upper())
                if area is None or not max_area:
                    continue
                values[i] = max(0.0, min(1.0, float(area) / max_area))
            count = len([v for v in values if v is not None])
            self._status("offload rsa %s residues=%d coverage=%.3f" % (target, count, count / max(len(ref), 1)))
            return json.dumps({
                "ok": True,
                "method": "ChimeraX measure sasa",
                "max_asa": "Tien et al. 2013",
                "model": target,
                "identity": identity,
                "coverage": count / max(len(ref), 1),
                "values": values,
            })
        except Exception as exc:
            self._status("offload rsa failed: %s" % exc)
            return "error: " + str(exc)

    def run_command(self, command):
        text = str(command or "").strip()
        if not text or "\n" in text or ";" in text:
            self.session.logger.error("Q2DV: rejected malformed command")
            return "error: malformed command"
        if not text.startswith(("select ", "color ", "label ")):
            self.session.logger.error("Q2DV: rejected command prefix: %s" % text[:40])
            return "error: command not allowed"
        self.session.logger.info("Q2DV: command=%s" % text)
        run(self.session, text)
        return "ok"

    def _load_bundle(self):
        candidates = []
        for bundle_dir in BUNDLE_CANDIDATES:
            if not bundle_dir.is_dir():
                continue
            try:
                manifest = json.loads((bundle_dir / "manifest.json").read_text())
                ep = manifest.get("entrypoints", {})
                def read(path, root=bundle_dir):
                    target = (root / path).resolve()
                    root_resolved = root.resolve()
                    if not (target == root_resolved or root_resolved in target.parents):
                        raise ValueError("bundle path escapes root: " + path)
                    return json.loads(target.read_text())
                bundle = {
                    "manifest": manifest,
                    "protein": read(ep.get("protein", "protein.json")),
                    "features": read(ep.get("features", "features.json")),
                    "claims": read(ep.get("claims", "claims.json")),
                    "relations": read(ep.get("relations", "relations.json")),
                    "evidence": read(ep.get("evidence", "evidence.json")),
                    "indexes": read(ep.get("indexes", "indexes.json")),
                    "legacyFeatures": [],
                    "profiles": {},
                }
                if ep.get("legacy_features"):
                    try:
                        bundle["legacyFeatures"] = read(ep["legacy_features"])
                    except Exception:
                        pass
                for key, path in (("homologs", "profiles/homologs.json"), ("lab_theses", "profiles/lab_theses.json"), ("structures", "profiles/structures.json")):
                    try:
                        bundle["profiles"][key] = read(path)
                    except Exception:
                        pass
                bundle["_dir"] = str(bundle_dir)
                candidates.append(bundle)
            except Exception as exc:
                self.session.logger.warning("Q2DV: skipping bundle %s: %s" % (bundle_dir, exc))
        self._bundles = candidates
        self._bundle_seq_attempted = ""
        self._status("bundle candidates=%d" % len(candidates))

    def _check_bundle_state(self):
        if not getattr(self, "_bundles", None):
            return
        js = (
            "JSON.stringify({"
            " seq: (typeof parsedTracks !== 'undefined' && parsedTracks.AA) ? String(parsedTracks.AA).replace(/\\s+/g, '') : '',"
            " bundleSeq: (typeof q2dvBundle !== 'undefined' && q2dvBundle && q2dvBundle.protein) ? String(q2dvBundle.protein.sequence || '').replace(/\\s+/g, '') : '',"
            " bundleId: (typeof q2dvBundle !== 'undefined' && q2dvBundle && q2dvBundle.protein) ? String(q2dvBundle.protein.id || '') : ''"
            "})"
        )
        self._page.runJavaScript(js, self._bundle_state)

    def _bundle_state(self, result):
        try:
            state = json.loads(result) if result else {}
        except Exception:
            return
        seq = state.get("seq") or ""
        self._q2dv_seq = seq
        current_seq = state.get("bundleSeq") or ""
        if not seq:
            if self._bundle_seq_attempted != "__empty__":
                self._bundle_seq_attempted = "__empty__"
                self._status("bundle wait: no sequence")
            return
        if seq == current_seq:
            self._bundle_seq_attempted = seq
            return
        if seq == self._bundle_seq_attempted:
            return
        bundle = next((b for b in self._bundles if str((b.get("protein") or {}).get("sequence") or "").replace(" ", "") == seq), None)
        if not bundle:
            self._bundle_seq_attempted = seq
            self._status("bundle no match: %d aa" % len(seq))
            self._clear_bundle()
            return
        self._bundle_seq_attempted = seq
        self._inject_bundle(bundle)

    def _inject_bundle(self, bundle):
        self._bank_bundle_structures(bundle)
        payload = json.dumps(bundle, separators=(",", ":"))
        js = (
            "(function () {"
            "const __bundle = " + payload + ";"
            "const __loaded = (typeof parsedTracks !== 'undefined' && parsedTracks.AA) ? String(parsedTracks.AA).replace(/\\s+/g, '') : '';"
            "const __expected = String(__bundle.protein && __bundle.protein.sequence || '').replace(/\\s+/g, '');"
            "if (!__loaded || __loaded !== __expected) {"
            "  return 'skipped: sequence changed';"
            "}"
            "if (typeof bundleFinalize !== 'function') {"
            "  return 'no finalize';"
            "}"
            "try {"
            "  if (typeof clearBundleTracks === 'function') clearBundleTracks();"
            "  bundleFinalize(__bundle, '', 'ChimeraX');"
            "  return 'loaded ' + (__bundle.protein && __bundle.protein.id || 'bundle');"
            "} catch (e) { return 'error: ' + (e && e.message ? e.message : e); }"
            "})()"
        )
        self._page.runJavaScript(js, self._bundle_result)

    def _bank_bundle_structures(self, bundle):
        root = pathlib.Path(str(bundle.get("_dir") or ""))
        if not root.is_dir():
            return
        protein = bundle.get("protein") or {}
        entries = protein.get("structures") or []
        banked = []
        auto_path = None
        auto_chain = None
        for entry in entries:
            rel = entry.get("path") or entry.get("local_path")
            if not rel:
                continue
            source = (root / rel).resolve()
            try:
                if not (source == root.resolve() or root.resolve() in source.parents):
                    continue
                if not source.is_file():
                    continue
                target = FILES_DIR / "structures" / source.name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                banked.append(str(target))
                if entry.get("auto_open") and auto_path is None:
                    auto_path = target
                    auto_chain = entry.get("auto_chain")
            except Exception as exc:
                self._status("bank failed %s: %s" % (rel, exc))
        if banked:
            self._status("bundle structures banked=%d" % len(banked))
        if auto_path is None:
            return
        has_model = any(hasattr(m, "residues") for m in self.session.models.list())
        if has_model:
            return
        try:
            before = {id(m) for m in self.session.models.list()}
            run(self.session, 'open "' + str(auto_path).replace('"', '\\"') + '"')
            opened = [m for m in self.session.models.list() if id(m) not in before and hasattr(m, "residues")]
            model = opened[0] if opened else None
            if model is not None and auto_chain:
                for chain in model.chains:
                    if str(chain.chain_id) != str(auto_chain):
                        run(self.session, 'hide #%s/%s' % (model.id_string, chain.chain_id))
                run(self.session, 'view #%s/%s' % (model.id_string, auto_chain))
            self._status("bundle structure opened=%s chain=%s" % (auto_path, auto_chain or "all"))
        except Exception as exc:
            self._status("bundle structure open failed: %s" % exc)

    def _clear_bundle(self):
        js = (
            "if (typeof clearBundleTracks === 'function') clearBundleTracks();"
            "if (typeof q2dvBundle !== 'undefined') q2dvBundle = null;"
            "if (typeof renderBundlePanel === 'function') renderBundlePanel();"
        )
        self._page.runJavaScript(js)

    def _bundle_result(self, result):
        self.session.logger.info("Q2DV: bundle check=%r" % (result,))
        self._status("bundle check=%r" % (result,))
        if isinstance(result, str) and (result.startswith("skipped") or result.startswith("error")):
            self._bundle_seq_attempted = ""

    def _model_candidates(self):
        """Every model chain that has a usable protein sequence."""
        bundle_by_seq = {}
        for bundle in getattr(self, "_bundles", None) or []:
            protein = bundle.get("protein") or {}
            seq = re.sub(r"\s+", "", str(protein.get("sequence") or "")).upper()
            if seq:
                bundle_by_seq[seq] = str(protein.get("id") or "")
        candidates = []
        try:
            models = self.session.models.list()
        except Exception:
            models = []
        for model in models:
            if not hasattr(model, "chains"):
                continue
            for chain in model.chains:
                residues = [r for r in chain.residues if r is not None and str(r.name).upper() in AA3_TO_ONE]
                if len(residues) < 2:
                    continue
                seq = "".join(AA3_TO_ONE.get(str(r.name).upper(), "X") for r in residues)
                candidates.append({
                    "model": str(model.id_string),
                    "name": str(getattr(model, "name", "") or ""),
                    "chain": str(chain.chain_id),
                    "length": len(residues),
                    "sequence": seq,
                    "bundle_id": bundle_by_seq.get(seq, ""),
                })
        candidates.sort(key=lambda c: (-bool(c.get("bundle_id")), -int(c.get("length") or 0), c.get("model", ""), c.get("chain", "")))
        return candidates

    def model_context(self):
        try:
            return json.dumps({
                "candidates": self._model_candidates(),
                "reference_length": len(self._q2dv_seq or ""),
            })
        except Exception as exc:
            self._status("model context failed: %s" % exc)
            return json.dumps({"candidates": [], "error": str(exc)})

    def set_selection_link_mode(self, mode):
        link_mode = str(mode or "both")
        if link_mode not in ("both", "to-host", "to-page", "off"):
            return "error: unknown selection link mode"
        self._selection_link_mode = link_mode
        self._settings["selection_link_mode"] = link_mode
        try:
            self._workspace.save_settings(self._settings)
        except Exception:
            pass
        self._status("selection link mode=%s" % link_mode)
        return "ok"

    def viewport_info(self):
        try:
            width = int(self.html_view.width())
            height = int(self.html_view.height())
            try:
                dpr = float(self.html_view.devicePixelRatioF())
            except Exception:
                dpr = 1.0
            screen_width = screen_height = 0
            try:
                from PyQt6.QtWidgets import QApplication
                screen = QApplication.primaryScreen()
                if screen is not None:
                    size = screen.size()
                    screen_width, screen_height = int(size.width()), int(size.height())
            except Exception:
                pass
            return json.dumps({
                "width": width, "height": height, "dpr": round(dpr, 3),
                "screen_width": screen_width, "screen_height": screen_height,
            })
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def _selected_residues(self):
        selection = getattr(self.session, "selection", None)
        try:
            if hasattr(selection, "items"):
                items = list(selection.items())
            elif hasattr(selection, "residues"):
                items = list(selection.residues())
            else:
                return []
        except Exception:
            return []
        residues = []
        seen = set()
        for item in items:
            res = item if hasattr(item, "chain") and hasattr(item, "number") and hasattr(item, "name") else getattr(item, "residue", None)
            if res is None or not hasattr(res, "chain"):
                continue
            if id(res) in seen:
                continue
            seen.add(id(res))
            residues.append(res)
        return residues

    def _ref_ranges_for_residues(self, selected):
        ref = re.sub(r"\s+", "", str(self._q2dv_seq or "")).upper()
        if not ref or not selected:
            return []
        positions = set()
        try:
            models = self.session.models.list()
        except Exception:
            models = []
        for model in models:
            if not hasattr(model, "chains"):
                continue
            for chain in model.chains:
                residues = [r for r in chain.residues if r is not None and str(r.name).upper() in AA3_TO_ONE]
                if len(residues) < 2:
                    continue
                seq = "".join(AA3_TO_ONE.get(str(r.name).upper(), "X") for r in residues)
                mapping = [None] * len(ref)
                for tag, i1, i2, j1, j2 in SequenceMatcher(None, ref, seq, autojunk=False).get_opcodes():
                    if tag == "equal":
                        for k in range(i2 - i1):
                            mapping[i1 + k] = residues[j1 + k]
                    elif tag == "replace":
                        rlen, slen = i2 - i1, j2 - j1
                        if rlen > 0 and slen > 0:
                            for k in range(rlen):
                                mapping[i1 + k] = residues[j1 + min(slen - 1, int(k * slen / rlen))]
                reverse = {}
                for ref_index, res in enumerate(mapping):
                    if res is not None:
                        reverse[id(res)] = ref_index
                for res in selected:
                    if id(res) in reverse:
                        positions.add(reverse[id(res)])
        if not positions:
            return []
        ordered = sorted(positions)
        ranges = []
        start = prev = ordered[0]
        for pos in ordered[1:]:
            if pos == prev + 1:
                prev = pos
                continue
            ranges.append([start + 1, prev + 1])
            start = prev = pos
        ranges.append([start + 1, prev + 1])
        return ranges

    def _check_host_selection(self):
        if self._selection_link_mode not in ("both", "to-page"):
            return
        if not self._q2dv_seq:
            return
        if time.monotonic() < self._selection_echo_until:
            return
        selected = self._selected_residues()
        if not selected and self._last_host_selection_key in ("", "[]"):
            # A fresh host has no selection; do not let that erase a restored
            # Q2DV selection. Only mirror a clear after the host had one.
            return
        ranges = self._ref_ranges_for_residues(selected)
        key = json.dumps(ranges)
        if key == self._last_host_selection_key:
            return
        self._last_host_selection_key = key
        js = (
            "if (typeof window.q2dvApplyHostSelection === 'function') {"
            " window.q2dvApplyHostSelection(" + key + ");"
            " 'applied';"
            "} else { 'missing'; }"
        )
        self._page.runJavaScript(js, self._host_selection_result)
        self._status("host selection->q2dv %s" % key)

    def _host_selection_result(self, result):
        if result == "missing":
            self._status("host selection: page callback missing")

    def run_agent_command(self, command):
        text = str(command or "").strip()
        if not text or "\n" in text or ";" in text:
            return "error: malformed command"
        if not text.lower().startswith(self.AGENT_COMMAND_PREFIXES):
            self._status("agent command rejected: %s" % text[:60])
            return "error: command not allowed"
        try:
            run(self.session, text)
        except Exception as exc:
            self._status("agent command failed: %s" % exc)
            return "error: %s" % exc
        self._status("agent command=%s" % text)
        return "ok"

    def agent_capabilities(self):
        version = "unknown"
        try:
            import chimerax
            version = getattr(chimerax, "__version__", version)
        except Exception:
            pass
        addons = []
        try:
            from importlib import metadata
            for dist in metadata.distributions():
                name = dist.metadata.get("Name") or ""
                if name.lower().startswith("chimerax-"):
                    addons.append({"name": name, "version": dist.version})
        except Exception:
            pass
        addons.sort(key=lambda item: item["name"].lower())
        return json.dumps({
            "schema": "q2dv.capability/1",
            "host": {"kind": "chimerax", "version": version},
            "commands": [prefix.strip() for prefix in self.AGENT_COMMAND_PREFIXES],
            "addons": addons,
            "limits": {"timeout_s": 120, "audit_max_bytes": 10 * 1024 * 1024},
            "note": "Add-on manifests live in ~/Q2DV_files/adapters/*.json; the command path is reviewed.",
        })

    def clear_workspace(self):
        try:
            path = self._workspace.clear_current()
            self._status("workspace cleared=%s" % path)
            return path or "ok"
        except Exception as exc:
            self._status("workspace clear failed: %s" % exc)
            return "error: " + str(exc)

    def restore_workspace(self):
        try:
            text = self._workspace.restore_latest()
            self._status("workspace restored=%s" % bool(text))
            return text
        except Exception as exc:
            self._status("workspace restore failed: %s" % exc)
            return "error: " + str(exc)

    def latest_backup(self):
        try:
            backups = sorted(
                self._workspace.backups.glob("current-*.json"),
                key=lambda path: path.stat().st_mtime,
                reverse=True,
            )
            return str(backups[0]) if backups else ""
        except Exception:
            return ""

    def literature(self, payload):
        try:
            data = json.loads(payload or "{}")
            topic = str(data.get("topic") or "").strip().lower()
            path = _REPO_ROOT / "mcp" / "literature.json"
            doc = json.loads(path.read_text(encoding="utf-8"))
            references = doc.get("references") or []
            checklists = doc.get("checklists") or {}
            if topic:
                references = [
                    ref for ref in references
                    if topic in [str(item).lower() for item in (ref.get("topics") or [])]
                    or topic in str(ref.get("title") or "").lower()
                ]
                if topic in checklists:
                    checklists = {topic: checklists[topic]}
            return json.dumps({
                "ok": True,
                "schema": doc.get("schema"),
                "updated_at": doc.get("updated_at"),
                "references": references,
                "checklists": checklists,
                "topic": topic,
            }, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)})

    def save_policy(self, text):
        try:
            payload = json.loads(str(text or "{}"))
            if not isinstance(payload, dict) or payload.get("schema") != "q2dv.policy/1":
                return "error: unsupported policy schema"
            path = FILES_DIR / "agent" / "policy.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_name(path.name + ".tmp")
            tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            tmp.replace(path)
            self._status("agent policy saved=%s" % path)
            return str(path)
        except Exception as exc:
            self._status("agent policy save failed: %s" % exc)
            return "error: " + str(exc)

    def load_policy(self):
        try:
            path = FILES_DIR / "agent" / "policy.json"
            if not path.is_file():
                return ""
            return path.read_text(encoding="utf-8")
        except Exception as exc:
            self._status("agent policy load failed: %s" % exc)
            return "error: " + str(exc)

    def addon_manifests(self):
        manifests = []
        for root in (_REPO_ROOT / "mcp" / "adapters", FILES_DIR / "adapters"):
            if not root.is_dir():
                continue
            for path in sorted(root.glob("*.json")):
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    if isinstance(data, dict) and data.get("schema") == "q2dv.capability/1":
                        data["path"] = str(path)
                        manifests.append(data)
                except Exception as exc:
                    self._status("adapter manifest skipped %s: %s" % (path.name, exc))
        return json.dumps({"ok": True, "schema": "q2dv.adapters/1", "manifests": manifests}, ensure_ascii=False)

    def mavedb_analysis(self, payload):
        if analyze_mavedb is None:
            return json.dumps({"ok": False, "error": "The MaveDB provider module is unavailable."})
        try:
            data = json.loads(payload or "{}")
            urn = str(data.get("urn") or "urn:mavedb:00000080-a-2")
            if not urn.startswith("urn:mavedb:"):
                return json.dumps({"ok": False, "error": "Only urn:mavedb score sets are accepted."})
            sequence = re.sub(r"\s+", "", str(data.get("sequence") or self._q2dv_seq or "")).upper()
            if not sequence:
                return json.dumps({"ok": False, "error": "Load a reference sequence first."})
            result = analyze_mavedb(
                urn=urn,
                sequence=sequence,
                cache_dir=FILES_DIR / "datasets" / "mavedb",
                weights=data.get("weights"),
                window=int(data.get("window") or 5),
                min_variants=int(data.get("min_variants") or 10),
                threshold=data.get("threshold"),
                refresh=bool(data.get("refresh")),
                cache_only=bool(data.get("cache_only")),
            )
            self._status("mavedb urn=%s rows=%s" % (urn, result.get("rows")))
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            self._status("mavedb failed: %s" % exc)
            return json.dumps({"ok": False, "error": str(exc)})

    def _agent_audit(self, request_id, status, payload):
        meta = self._agent_requests.pop(request_id, None) or {}
        request = meta.get("request") or {}
        try:
            path = FILES_DIR / "agent" / "audit.jsonl"
            path.parent.mkdir(parents=True, exist_ok=True)
            record = {
                "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "id": request_id,
                "action": request.get("action"),
                "actor": request.get("actor"),
                "args": request.get("args"),
                "status": status,
                "duration_ms": int(max(0.0, time.time() - meta.get("started", time.time())) * 1000),
            }
            line = json.dumps(record, ensure_ascii=False)
            if len(line) > 4000:
                line = line[:4000]
            with path.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
            self._agent_rotate_audit(path)
        except Exception as exc:
            self._status("agent audit failed: %s" % exc)

    def _agent_rotate_audit(self, path, max_bytes=10 * 1024 * 1024, keep=2):
        try:
            if path.stat().st_size <= max_bytes:
                return
            oldest = path.with_name(path.name + "." + str(keep))
            if oldest.exists():
                oldest.unlink()
            for index in range(keep - 1, 0, -1):
                src = path.with_name(path.name + "." + str(index))
                if src.exists():
                    src.replace(path.with_name(path.name + "." + str(index + 1)))
            path.replace(path.with_name(path.name + ".1"))
        except OSError as exc:
            self._status("agent audit rotate failed: %s" % exc)

    def _agent_socket_path(self):
        return FILES_DIR / "agent" / "agent.sock"

    def _start_agent_server(self):
        if self._agent_server is not None:
            return
        path = self._agent_socket_path()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            os.chmod(path.parent, 0o700)
        except OSError:
            pass
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass
        server = QLocalServer()
        if not server.listen(str(path)):
            self.session.logger.error("Q2DV: agent socket listen failed: %s" % server.errorString())
            self._status("agent socket failed: %s" % server.errorString())
            return
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        server.newConnection.connect(self._agent_accept)
        self._agent_server = server
        self.session.logger.info("Q2DV: agent socket %s" % path)
        self._status("agent socket listening=%s" % path)

    def _agent_accept(self):
        if self._agent_server is None:
            return
        while self._agent_server.hasPendingConnections():
            sock = self._agent_server.nextPendingConnection()
            if sock is None:
                break
            self._agent_sockets.append(sock)
            self._agent_buffers[sock] = b""
            sock.readyRead.connect(lambda s=sock: self._agent_read(s))
            sock.disconnected.connect(lambda s=sock: self._agent_drop(s))
            if sock.bytesAvailable():
                self._agent_read(sock)

    def _agent_read(self, sock):
        buf = self._agent_buffers.get(sock, b"") + bytes(sock.readAll())
        if b"\n" not in buf:
            self._agent_buffers[sock] = buf
            return
        line, _, rest = buf.partition(b"\n")
        self._agent_buffers[sock] = rest
        try:
            payload = json.loads(line.decode("utf-8"))
        except Exception as exc:
            self._agent_reply(sock, {"schema": "q2dv.agent.result/1", "status": "error", "error": {"code": "validation", "message": "Invalid request: %s" % exc}})
            return
        request = payload.get("request") if isinstance(payload, dict) else None
        if not isinstance(request, dict):
            self._agent_reply(sock, {"schema": "q2dv.agent.result/1", "status": "error", "error": {"code": "validation", "message": "Missing request object"}})
            return
        self._agent_dispatch(sock, request)

    def _agent_drop(self, sock):
        self._agent_buffers.pop(sock, None)
        if sock in self._agent_sockets:
            self._agent_sockets.remove(sock)
        try:
            sock.deleteLater()
        except Exception:
            pass

    def _agent_dispatch(self, sock, request):
        request_id = uuid.uuid4().hex
        self._agent_pending[request_id] = sock
        self._agent_requests[request_id] = {"request": request, "started": time.time()}
        timer = QTimer(self.html_view)
        timer.setSingleShot(True)
        timer.setInterval(120000)
        timer.timeout.connect(lambda rid=request_id: self._agent_timeout(rid))
        timer.start()
        self._agent_timers[request_id] = timer
        script = "window.__q2dvAgentCall && window.__q2dvAgentCall(%s, %s);" % (
            json.dumps(request_id), json.dumps(json.dumps(request, ensure_ascii=False)))
        self._page.runJavaScript(script)

    def _agent_timeout(self, request_id):
        if request_id not in self._agent_pending:
            return
        timer = self._agent_timers.pop(request_id, None)
        if timer is not None:
            timer.stop()
        sock = self._agent_pending.pop(request_id, None)
        if sock is not None:
            self._agent_audit(request_id, "host_timeout", None)
            self._agent_reply(sock, {"schema": "q2dv.agent.result/1", "status": "error", "error": {"code": "host_timeout", "message": "The Q2DV page did not answer within 120 seconds."}})

    def agent_result(self, request_id, result_json):
        if request_id not in self._agent_pending:
            return
        timer = self._agent_timers.pop(request_id, None)
        if timer is not None:
            timer.stop()
        sock = self._agent_pending.pop(request_id, None)
        if sock is None:
            return
        try:
            payload = json.loads(result_json) if isinstance(result_json, str) else result_json
        except ValueError:
            payload = {"schema": "q2dv.agent.result/1", "status": "error", "error": {"code": "internal", "message": "The page returned invalid JSON."}}
        self._agent_audit(request_id, payload.get("status") if isinstance(payload, dict) else "error", payload)
        self._agent_reply(sock, payload)

    def _agent_reply(self, sock, payload):
        try:
            text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
        except (TypeError, ValueError):
            text = json.dumps({"status": "error", "error": {"code": "internal", "message": "Could not serialise the reply."}})
        try:
            sock.write((text + "\n").encode("utf-8"))
            sock.flush()
        except Exception as exc:
            self._status("agent reply failed: %s" % exc)
        try:
            sock.disconnectFromServer()
        except Exception:
            pass

    def delete(self):
        server = getattr(self, "_agent_server", None)
        if server is not None:
            try:
                server.close()
            except Exception:
                pass
            self._agent_server = None
        for timer in list(getattr(self, "_agent_timers", {}).values()):
            try:
                timer.stop()
            except Exception:
                pass
        self._agent_timers = {}
        self._agent_pending = {}
        self._agent_requests = {}
        for sock in list(getattr(self, "_agent_sockets", [])):
            try:
                sock.disconnectFromServer()
            except Exception:
                pass
        self._agent_sockets = []
        try:
            path = self._agent_socket_path()
            if path.exists():
                path.unlink()
        except OSError:
            pass
        for attr in ("_bundle_timer", "_selection_timer"):
            timer = getattr(self, attr, None)
            if timer is not None:
                timer.stop()
        try:
            size = self.html_view.window().size()
            self._settings["window"] = {"width": int(size.width()), "height": int(size.height())}
            self._workspace.save_settings(self._settings)
        except Exception:
            pass
        super().delete()
