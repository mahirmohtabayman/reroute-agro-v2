"""English catalogue (web/1b_i18n_catalog.js): well-formed, and every Bangla message the server can send to the
browser (errors, notifications, assistant answers) has a whole-sentence English translation."""
import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BN = re.compile(r"[ঀ-৿]")


def catalogue():
    src = (ROOT / "web" / "1b_i18n_catalog.js").read_text(encoding="utf-8")
    body = src[src.index("var I18N_CATALOG = [") + len("var I18N_CATALOG = "):src.index("];", src.index("var I18N_CATALOG")) + 1]
    return json.loads(body)


def as_regex(bn):
    parts = re.split(r"(\{#?\})", bn)
    return re.compile("^" + "".join(".+?" if p in ("{}", "{#}") else re.escape(p) for p in parts) + "$")


def test_catalogue_is_well_formed():
    rows = catalogue()
    assert len(rows) > 1200
    keys = [bn for bn, _ in rows]
    assert len(keys) == len(set(keys)), "duplicate Bangla keys"
    for bn, en in rows:
        assert BN.search(bn), bn
        assert not BN.search(en.replace("৳", "")), f"English side still has Bangla: {en}"
        n_bn = len(re.findall(r"\{#?\}", bn))
        idx = [int(i) for i in re.findall(r"\{(\d+)\}", en)]
        n_en = len(re.findall(r"\{\}", en))
        assert (idx and max(idx) < n_bn) or n_en <= n_bn, f"placeholder mismatch: {bn} → {en}"


def server_messages():
    """Bangla strings passed to HTTPException / fail() / notify() in app/*.py (f-string values become {})."""
    out = set()
    for f in (ROOT / "app").glob("*.py"):
        tree = ast.parse(f.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name not in ("HTTPException", "fail", "notify"):
                continue
            for arg in node.args[:2]:
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str) and BN.search(arg.value):
                    out.add(arg.value)
                elif isinstance(arg, ast.JoinedStr):
                    text = "".join(v.value if isinstance(v, ast.Constant) else "{}" for v in arg.values)
                    if BN.search(text):
                        out.add(text)
    return out


def test_every_server_message_has_an_english_sentence():
    rows = catalogue()
    exact = {re.sub(r"\s+", " ", bn).strip() for bn, _ in rows}
    pats = [as_regex(bn) for bn, _ in rows if "{" in bn]
    missing = []
    for msg in server_messages():
        m = re.sub(r"\s+", " ", msg).strip()
        sample = m.replace("{}", "7")
        if m in exact or sample in exact or any(p.match(sample) for p in pats):
            continue
        missing.append(m)
    assert not missing, "no English for:\n" + "\n".join(sorted(missing))
