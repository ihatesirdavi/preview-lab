"""Validate public preview catalog provenance and safe relative asset references."""

import json
import re
from pathlib import Path

ALLOWED_STATES = {"prototype", "candidate", "released", "archived"}
CHECK_VALUES = {
    "source": {"passed", "failed", "not_run"},
    "browser": {"passed", "failed", "not_run"},
    "owner_review": {"pending", "passed", "rejected"},
    "packaging": {"not_packaged", "candidate", "packaged"},
}
OPTIONAL_FIELDS = {
    "owner_review_receipt",
    "browser_receipt",
    "release_receipt",
}


def validate(root: Path) -> list[str]:
    """Return every detected catalog violation without modifying files."""
    root = root.resolve()
    registry = root / "previews" / "index.json"
    if not registry.is_file():
        return ["missing public preview catalog"]
    try:
        data = json.loads(registry.read_text(encoding="utf-8-sig"))
    except (ValueError, OSError) as exc:
        return [f"invalid preview catalog: {exc}"]
    if not isinstance(data, dict) or set(data) != {"schema_version", "previews"}:
        return ["unexpected catalog keys"]
    if type(data["schema_version"]) is not int or data["schema_version"] != 1:
        return ["unsupported catalog schema_version"]
    previews = data["previews"]
    if not isinstance(previews, list) or not (1 <= len(previews) <= 10):
        return ["catalog must hold 1-10 public previews"]
    errors: list[str] = []
    ids: set[str] = set()
    for index, item in enumerate(previews):
        prefix = f"preview[{index}]"
        required = {"id", "title", "asset", "classification", "state", "checks"}
        if not isinstance(item, dict) or not required <= set(item) or set(item) - required - OPTIONAL_FIELDS:
            errors.append(f"{prefix}: missing or unexpected fields")
            continue
        identifier = item["id"]
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-z][a-z0-9-]{1,48}", identifier):
            errors.append(f"{prefix}: invalid id")
        elif identifier in ids:
            errors.append(f"{prefix}: duplicate id")
        else:
            ids.add(identifier)
        if not isinstance(item["title"], str) or not (3 <= len(item["title"]) <= 80):
            errors.append(f"{prefix}: invalid title")
        if item["classification"] != "standalone-public":
            errors.append(f"{prefix}: nonpublic classification")
        if item["state"] not in ALLOWED_STATES:
            errors.append(f"{prefix}: unsupported state")
        asset = item["asset"]
        if not isinstance(asset, str) or not asset.startswith("docs/") or "\\" in asset:
            errors.append(f"{prefix}: asset must be under docs/")
        else:
            target = (root / asset).resolve()
            docs_dir = (root / "docs").resolve()
            if not target.is_relative_to(docs_dir) or not target.is_file():
                errors.append(f"{prefix}: asset outside docs/ or missing")
        checks = item["checks"]
        if not isinstance(checks, dict) or set(checks) != set(CHECK_VALUES):
            errors.append(f"{prefix}: invalid checks keys")
            continue
        for key, values in CHECK_VALUES.items():
            if checks[key] not in values:
                errors.append(f"{prefix}: invalid {key} result")
        if checks["owner_review"] == "passed" and not item.get("owner_review_receipt"):
            errors.append(f"{prefix}: owner review requires receipt")
        if checks["browser"] == "passed" and not item.get("browser_receipt"):
            errors.append(f"{prefix}: browser review requires receipt")
        if checks["packaging"] == "packaged" and not item.get("release_receipt"):
            errors.append(f"{prefix}: package requires release receipt")
        if item["state"] == "released" and checks["owner_review"] != "passed":
            errors.append(f"{prefix}: released requires owner acceptance")
    return errors


if __name__ == "__main__":
    import sys
    issues = validate(Path(__file__).resolve().parents[1])
    for issue in issues:
        print("FAIL:", issue)
    if issues:
        sys.exit(1)
    print("Preview catalog valid")