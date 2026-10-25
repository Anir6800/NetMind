"""Write data/templates/<id>.json for every prepared lab (SIMULATED topology JSON)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from app.services.templates import TEMPLATES, build_template


def main() -> None:
    out = Path(__file__).parents[1] / "data/templates"
    out.mkdir(parents=True, exist_ok=True)
    for template in TEMPLATES:
        data = build_template(template).model_dump(mode="json")
        (out / f"{template['id']}.json").write_text(json.dumps(data, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(TEMPLATES)} templates to {out}")


if __name__ == "__main__":
    main()
