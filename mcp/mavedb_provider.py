#!/usr/bin/env python3
"""MaveDB CSV provider for Q2DV.

Fetches a public MaveDB score set, parses HGVS protein variants, maps each
substitution onto the Q2DV reference sequence, and returns per-residue
components plus ranked windows.

The provider is stdlib-only so it can run inside the ChimeraX host. Network
access is limited to api.mavedb.org; caching and pruning are local.
"""

import csv
import io
import json
import math
import re
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

DEFAULT_URN = "urn:mavedb:00000080-a-2"
DEFAULT_WEIGHTS = {"coverage": 0.3, "effect": 0.4, "deleterious": 0.3}
MAX_CSV_BYTES = 200 * 1024 * 1024
CACHE_KEEP = 5

AA3 = {
    "ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C",
    "GLN": "Q", "GLU": "E", "GLY": "G", "HIS": "H", "ILE": "I",
    "LEU": "L", "LYS": "K", "MET": "M", "PHE": "F", "PRO": "P",
    "SER": "S", "THR": "T", "TRP": "W", "TYR": "Y", "VAL": "V",
}
AA1 = set("ACDEFGHIKLMNPQRSTVWY")
CODON = {}
for _a, _b, _c, _aa in (
    ("T", "T", "T", "F"), ("T", "T", "C", "F"), ("T", "T", "A", "L"), ("T", "T", "G", "L"),
    ("T", "C", "T", "S"), ("T", "C", "C", "S"), ("T", "C", "A", "S"), ("T", "C", "G", "S"),
    ("T", "A", "T", "Y"), ("T", "A", "C", "Y"), ("T", "A", "A", "*"), ("T", "A", "G", "*"),
    ("T", "G", "T", "C"), ("T", "G", "C", "C"), ("T", "G", "A", "*"), ("T", "G", "G", "W"),
    ("C", "T", "T", "L"), ("C", "T", "C", "L"), ("C", "T", "A", "L"), ("C", "T", "G", "L"),
    ("C", "C", "T", "P"), ("C", "C", "C", "P"), ("C", "C", "A", "P"), ("C", "C", "G", "P"),
    ("C", "A", "T", "H"), ("C", "A", "C", "H"), ("C", "A", "A", "Q"), ("C", "A", "G", "Q"),
    ("C", "G", "T", "R"), ("C", "G", "C", "R"), ("C", "G", "A", "R"), ("C", "G", "G", "R"),
    ("A", "T", "T", "I"), ("A", "T", "C", "I"), ("A", "T", "A", "I"), ("A", "T", "G", "M"),
    ("A", "C", "T", "T"), ("A", "C", "C", "T"), ("A", "C", "A", "T"), ("A", "C", "G", "T"),
    ("A", "A", "T", "N"), ("A", "A", "C", "N"), ("A", "A", "A", "K"), ("A", "A", "G", "K"),
    ("A", "G", "T", "S"), ("A", "G", "C", "S"), ("A", "G", "A", "R"), ("A", "G", "G", "R"),
    ("G", "T", "T", "V"), ("G", "T", "C", "V"), ("G", "T", "A", "V"), ("G", "T", "G", "V"),
    ("G", "C", "T", "A"), ("G", "C", "C", "A"), ("G", "C", "A", "A"), ("G", "C", "G", "A"),
    ("G", "A", "T", "D"), ("G", "A", "C", "D"), ("G", "A", "A", "E"), ("G", "A", "G", "E"),
    ("G", "G", "T", "G"), ("G", "G", "C", "G"), ("G", "G", "A", "G"), ("G", "G", "G", "G"),
):
    CODON[_a + _b + _c] = _aa
HGVS_RE = re.compile(r"(?<![A-Za-z])([A-Z][a-z]{2}|[A-Z])(\d+)([A-Z][a-z]{2}|[A-Z])")


def translate_dna(dna):
    text = re.sub(r"\s+", "", str(dna or "")).upper()
    text = text[:len(text) - (len(text) % 3)]
    protein = "".join(CODON.get(text[i:i + 3], "X") for i in range(0, len(text), 3))
    return protein.rstrip("*")


def target_protein(metadata):
    genes = (metadata or {}).get("targetGenes") or []
    for gene in genes:
        target = gene.get("targetSequence") if isinstance(gene, dict) else None
        if not isinstance(target, dict):
            continue
        sequence = str(target.get("sequence") or "")
        kind = str(target.get("sequenceType") or "").lower()
        if kind in ("dna", "nucleotide"):
            protein = translate_dna(sequence)
        elif kind in ("protein", "amino_acid", "aminoacid"):
            protein = re.sub(r"\s+", "", sequence).upper()
        else:
            protein = translate_dna(sequence) if re.search(r"^[ACGTNacgtn\s]+$", sequence) else re.sub(r"\s+", "", sequence).upper()
        if protein:
            return protein
    return ""


def align_positions(dms_seq, ref_seq):
    """Map 1-based DMS positions to 1-based reference positions."""
    mapping = {}
    if not dms_seq or not ref_seq:
        return mapping, None
    matcher = SequenceMatcher(None, dms_seq, ref_seq, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal" or (tag == "replace" and (i2 - i1) == (j2 - j1)):
            for offset in range(i2 - i1):
                mapping[i1 + offset + 1] = j1 + offset + 1
    return mapping, matcher.ratio()


def aa1(token):
    text = str(token or "")
    if len(text) == 1:
        return text if text in AA1 else None
    return AA3.get(text.upper())


def parse_hgvs_pro(text):
    """Return [{pos, wt, mut}] for every substitution in a protein HGVS string."""
    out = []
    for match in HGVS_RE.finditer(str(text or "")):
        wt = aa1(match.group(1))
        mut = aa1(match.group(3))
        pos = int(match.group(2))
        if wt and mut and pos >= 1:
            out.append({"pos": pos, "wt": wt, "mut": mut})
    return out


def parse_scores_csv(text):
    reader = csv.DictReader(io.StringIO(text or ""))
    rows = []
    for row in reader:
        try:
            score = float(row.get("score"))
        except (TypeError, ValueError):
            continue
        substitutions = parse_hgvs_pro(row.get("hgvs_pro"))
        if not substitutions:
            continue
        rows.append({
            "hgvs": row.get("hgvs_pro") or "",
            "score": score,
            "barcodes": row.get("uniqueBarcodes") or "",
            "substitutions": substitutions,
        })
    return rows


def percentile(values, p):
    if not values:
        return None
    ordered = sorted(values)
    k = (len(ordered) - 1) * (p / 100.0)
    low = int(math.floor(k))
    high = int(math.ceil(k))
    if low == high:
        return ordered[low]
    return ordered[low] * (high - k) + ordered[high] * (k - low)


def normalize_weights(weights):
    if isinstance(weights, (list, tuple)) and len(weights) == 3:
        raw = {"coverage": weights[0], "effect": weights[1], "deleterious": weights[2]}
    elif isinstance(weights, dict):
        raw = {
            "coverage": weights.get("coverage", DEFAULT_WEIGHTS["coverage"]),
            "effect": weights.get("effect", DEFAULT_WEIGHTS["effect"]),
            "deleterious": weights.get("deleterious", DEFAULT_WEIGHTS["deleterious"]),
        }
    else:
        raw = dict(DEFAULT_WEIGHTS)
    clean = {}
    for key in ("coverage", "effect", "deleterious"):
        try:
            value = max(0.0, float(raw.get(key, 0.0)))
        except (TypeError, ValueError):
            value = 0.0
        clean[key] = value
    total = sum(clean.values())
    if total <= 0:
        clean = dict(DEFAULT_WEIGHTS)
        total = sum(clean.values())
    return {key: value / total for key, value in clean.items()}


def _mean(values):
    return (sum(values) / len(values)) if values else 0.0


def combined_residues(rows, sequence, weights=None, window=5, min_variants=10, threshold=None):
    """Aggregate parsed rows into per-residue components and ranked windows."""
    seq = re.sub(r"\s+", "", str(sequence or "")).upper()
    weight = normalize_weights(weights)
    window = max(1, int(window or 5))
    min_variants = max(1, int(min_variants or 10))
    if not seq:
        return {"ok": False, "error": "A reference sequence is required."}
    if not rows:
        return {"ok": False, "error": "No usable MaveDB variants were parsed."}

    scores = [row["score"] for row in rows]
    p5 = percentile(scores, 5)
    p25 = percentile(scores, 25)
    p50 = percentile(scores, 50)
    p95 = percentile(scores, 95)
    span = (p95 - p5) if p95 is not None and p5 is not None and p95 > p5 else 1.0
    cutoff = float(threshold) if threshold is not None else p25

    by_pos = {}
    mapped_rows = 0
    skipped_rows = 0
    substitutions = 0
    mismatches = []
    for row in rows:
        mapped_here = False
        effect = max(0.0, (p95 - row["score"]) / span)
        deleterious = 1.0 if (cutoff is not None and row["score"] < cutoff) else 0.0
        for sub in row["substitutions"]:
            substitutions += 1
            pos = sub["pos"]
            if pos < 1 or pos > len(seq):
                continue
            mapped_here = True
            if seq[pos - 1] != sub["wt"] and len(mismatches) < 20:
                mismatches.append({"pos": pos, "expected": seq[pos - 1], "hgvs_wt": sub["wt"]})
            bucket = by_pos.setdefault(pos, {"obs": 0, "effect": [], "deleterious": [], "pairs": set()})
            bucket["obs"] += 1
            bucket["effect"].append(effect)
            bucket["deleterious"].append(deleterious)
            bucket["pairs"].add((sub["wt"], sub["mut"]))
        if mapped_here:
            mapped_rows += 1
        else:
            skipped_rows += 1

    residues = []
    for pos in range(1, len(seq) + 1):
        bucket = by_pos.get(pos)
        if not bucket:
            residues.append({"pos": pos, "n": 0, "coverage": None, "effect": None, "deleterious": None, "combined": None})
            continue
        coverage = min(1.0, len(bucket["pairs"]) / 19.0)
        effect = _mean(bucket["effect"])
        deleterious = _mean(bucket["deleterious"])
        combined = (weight["coverage"] * coverage +
                    weight["effect"] * effect +
                    weight["deleterious"] * deleterious)
        residues.append({
            "pos": pos,
            "n": bucket["obs"],
            "coverage": coverage,
            "effect": effect,
            "deleterious": deleterious,
            "combined": combined if bucket["obs"] >= min_variants else None,
        })

    windows = []
    for start in range(1, max(1, len(seq) - window + 2)):
        entries = [r for r in residues[start - 1:start - 1 + window] if r.get("combined") is not None]
        total_obs = sum(r["n"] for r in entries)
        if len(entries) < max(2, window // 2) or total_obs < min_variants:
            continue
        windows.append({
            "start": start,
            "end": min(len(seq), start + window - 1),
            "score": _mean([r["combined"] for r in entries]),
            "coverage": _mean([r["coverage"] for r in entries]),
            "effect": _mean([r["effect"] for r in entries]),
            "deleterious": _mean([r["deleterious"] for r in entries]),
            "n": total_obs,
        })
    windows.sort(key=lambda item: item["score"], reverse=True)
    clusters = []
    for candidate in windows:
        if any(not (candidate["end"] < chosen["start"] or candidate["start"] > chosen["end"]) for chosen in clusters):
            continue
        clusters.append(candidate)
        if len(clusters) >= 5:
            break
    clusters.sort(key=lambda item: item["score"], reverse=True)

    top = clusters[0] if clusters else None
    summary = (
        "Top cluster %d-%d: combined %.2f (coverage %.2f, effect %.2f, deleterious %.2f, n=%d)." %
        (top["start"], top["end"], top["score"], top["coverage"], top["effect"], top["deleterious"], top["n"])
        if top else "No window met the minimum observation threshold."
    )
    return {
        "ok": True,
        "schema": "q2dv.mavedb/1",
        "sequence_length": len(seq),
        "rows": len(rows),
        "mapped_rows": mapped_rows,
        "skipped_rows": skipped_rows,
        "substitutions": substitutions,
        "wt_mismatches": len(mismatches),
        "wt_mismatch_examples": mismatches,
        "weights": weight,
        "window": window,
        "min_variants": min_variants,
        "threshold": cutoff,
        "percentiles": {"p5": p5, "p25": p25, "p50": p50, "p95": p95},
        "residues": residues,
        "top_clusters": clusters,
        "summary": summary,
    }


def _safe_name(urn):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(urn or "mavedb"))


def fetch_text(url, timeout=60):
    request = urllib.request.Request(url, headers={
        "User-Agent": "Q2DV/0.72 mavedb-provider",
        "Accept": "text/csv, application/json",
    })
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if getattr(response, "status", 200) != 200:
            raise RuntimeError("HTTP %s for %s" % (response.status, url))
        data = response.read(MAX_CSV_BYTES + 1)
    if len(data) > MAX_CSV_BYTES:
        raise RuntimeError("MaveDB response exceeds the %d byte cap." % MAX_CSV_BYTES)
    return data.decode("utf-8", "replace")


def fetch_scores(urn, timeout=60):
    url = "https://api.mavedb.org/api/v1/score-sets/" + urllib.parse.quote(urn, safe=":") + "/scores"
    return fetch_text(url, timeout=timeout)


def fetch_metadata(urn, timeout=30):
    url = "https://api.mavedb.org/api/v1/score-sets/" + urllib.parse.quote(urn, safe=":")
    try:
        return json.loads(fetch_text(url, timeout=timeout))
    except Exception:
        return {}


def prune_cache(cache_dir, keep=CACHE_KEEP):
    try:
        files = sorted(cache_dir.glob("*.csv"), key=lambda path: path.stat().st_mtime, reverse=True)
        for path in files[keep:]:
            path.unlink()
    except OSError:
        pass


def analyze_mavedb(urn=DEFAULT_URN, sequence="", cache_dir=None, weights=None, window=5,
                   min_variants=10, threshold=None, refresh=False, cache_only=False, fetch=None,
                   dms_sequence=None):
    cache_dir = Path(cache_dir) if cache_dir else Path.home() / "Q2DV_files" / "datasets" / "mavedb"
    cache_dir.mkdir(parents=True, exist_ok=True)
    csv_path = cache_dir / (_safe_name(urn) + ".csv")
    meta_path = cache_dir / (_safe_name(urn) + ".json")
    fetcher = fetch or fetch_scores

    if not cache_only and (refresh or not csv_path.exists() or csv_path.stat().st_size == 0):
        text = fetcher(urn)
        tmp = csv_path.with_name(csv_path.name + ".tmp")
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(csv_path)
        meta = fetch_metadata(urn)
        if meta:
            meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        prune_cache(cache_dir)
    if not csv_path.exists():
        return {"ok": False, "error": "No cached MaveDB file and no fetch was allowed."}
    text = csv_path.read_text(encoding="utf-8", errors="replace")
    meta = {}
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    except ValueError:
        meta = {}
    if not meta and not cache_only:
        meta = fetch_metadata(urn)
        if meta:
            try:
                meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
            except OSError:
                pass
    rows = parse_scores_csv(text)
    dms_protein = re.sub(r"\s+", "", str(dms_sequence or "")).upper() or target_protein(meta)
    mapping, ratio = align_positions(dms_protein, sequence)
    if mapping:
        mapping_method = "sequence-alignment"
    else:
        mapping = {index: index for index in range(1, len(sequence) + 1)}
        mapping_method = "identity"
    dms_mismatches = 0
    mapped_rows = []
    for row in rows:
        substitutions = []
        for sub in row["substitutions"]:
            if dms_protein and 1 <= sub["pos"] <= len(dms_protein) and dms_protein[sub["pos"] - 1] != sub["wt"]:
                dms_mismatches += 1
            ref_pos = mapping.get(sub["pos"])
            if ref_pos is None:
                continue
            substitutions.append({"pos": ref_pos, "dms_pos": sub["pos"], "wt": sub["wt"], "mut": sub["mut"]})
        if substitutions:
            mapped_rows.append({"score": row["score"], "substitutions": substitutions, "hgvs": row["hgvs"]})
    result = combined_residues(mapped_rows, sequence, weights=weights, window=window,
                               min_variants=min_variants, threshold=threshold)
    result.update({
        "urn": urn,
        "title": meta.get("title") or "MaveDB score set",
        "license": (meta.get("license") or {}).get("shortName") or "",
        "num_variants": meta.get("numVariants") if meta else None,
        "cache_path": str(csv_path),
        "dms_sequence_length": len(dms_protein),
        "mapped_positions": len(mapping),
        "skipped_positions": len(dms_protein) - len(mapping) if dms_protein else 0,
        "alignment_ratio": ratio,
        "mapping_method": mapping_method,
        "dms_mismatches": dms_mismatches,
    })
    return result
