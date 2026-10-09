"""Builds static/index.html from the frontend source parts in web/."""
from pathlib import Path
root = Path(__file__).parent
parts = sorted((root / "web").iterdir())
(root / "static" / "index.html").write_text("".join(p.read_text(encoding="utf-8") for p in parts), encoding="utf-8")
print("built static/index.html from", [p.name for p in parts])
