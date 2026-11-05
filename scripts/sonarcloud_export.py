#!/usr/bin/env python3
"""Export the SonarQube Cloud analysis to GitHub Actions artifacts.

Uses only the Python standard library. No credentials are written to artifacts.
"""
import csv
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

BASE_URL = "https://sonarcloud.io"
PROJECT = os.getenv("PROJECT_KEY", "danielmigueltejedor_nodalia-cards").strip()
TOKEN = os.getenv("SONAR_TOKEN", "").strip()
OUTPUT = Path("sonarcloud-report")
PAGE_SIZE = 100
MAX_RESULTS = 10000
METRICS = (
    "security_rating,reliability_rating,sqale_rating,coverage,"
    "duplicated_lines_density,new_security_rating,new_reliability_rating,"
    "new_maintainability_rating,new_coverage,new_duplicated_lines_density"
)
GRADES = {"1.0": "A", "2.0": "B", "3.0": "C", "4.0": "D", "5.0": "E"}
SEVERITIES = {"BLOCKER": 5, "HIGH": 4, "CRITICAL": 4, "MEDIUM": 3, "MAJOR": 3, "LOW": 2, "MINOR": 2, "INFO": 1}


def request_json(endpoint, parameters):
    query = urllib.parse.urlencode(parameters)
    url = f"{BASE_URL}/{endpoint}?{query}"
    headers = {"Accept": "application/json", "User-Agent": "nodalia-cards-sonarcloud-export/1.0"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        # Never log request headers or secrets.
        raise RuntimeError(f"{endpoint}: HTTP {exc.code} {exc.reason}; check SonarCloud access, project key, or SONAR_TOKEN") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{endpoint}: network error: {exc.reason}") from exc


def paginated(endpoint, parameters, item_key, warnings):
    items = []
    total = 0
    page = 1
    while True:
        payload = request_json(endpoint, {**parameters, "p": page, "ps": PAGE_SIZE})
        batch = payload.get(item_key, [])
        if not isinstance(batch, list):
            raise RuntimeError(f"{endpoint}: unexpected '{item_key}' response format")
        total = payload.get("total", len(batch))
        items.extend(batch)
        if not batch or len(items) >= total:
            break
        if page * PAGE_SIZE >= MAX_RESULTS:
            warnings.append(f"{endpoint}: only {len(items)} of {total} records retrieved (API pagination cap)")
            break
        page += 1
    return {"total": total, "retrieved": len(items), "complete": len(items) >= total, item_key: items}


def save(name, data):
    (OUTPUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def escape_table(value):
    return str(value or "—").replace("|", r"\|").replace("\n", " ")[:150]


def grade(value):
    try:
        return GRADES.get(f"{float(value):.1f}", str(value))
    except (TypeError, ValueError):
        return str(value or "—")


def main():
    if not PROJECT:
        raise ValueError("PROJECT_KEY cannot be blank")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    warnings = []
    errors = []
    results = {}

    endpoints = [
        ("issues", "api/issues/search", {"componentKeys": PROJECT}, "issues"),
        ("hotspots", "api/hotspots/search", {"projectKey": PROJECT}, "hotspots"),
        ("measures", "api/measures/component", {"component": PROJECT, "metricKeys": METRICS}, None),
        ("quality_gate", "api/qualitygates/project_status", {"projectKey": PROJECT}, None),
    ]
    for filename, endpoint, parameters, item_key in endpoints:
        try:
            data = paginated(endpoint, parameters, item_key, warnings) if item_key else request_json(endpoint, parameters)
            results[filename] = data
            save(f"{filename}.json", data)
            print(f"OK: {endpoint}")
        except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
            errors.append(str(exc))
            print(f"ERROR: {exc}", file=sys.stderr)

    issues = results.get("issues", {}).get("issues", [])
    if issues:
        with (OUTPUT / "issues.csv").open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(["key", "rule", "message", "component", "line", "status", "severity", "type", "impacts"])
            for issue in issues:
                impacts = "; ".join(
                    f"{impact.get('softwareQuality')}:{impact.get('severity')}"
                    for impact in issue.get("impacts", [])
                )
                writer.writerow([
                    issue.get("key"), issue.get("rule"), issue.get("message"),
                    issue.get("component"), issue.get("line"), issue.get("status"),
                    issue.get("severity"), issue.get("type"), impacts,
                ])

    metrics = {
        measure.get("metric"): measure.get("value")
        for measure in results.get("measures", {}).get("component", {}).get("measures", [])
    }
    gate = results.get("quality_gate", {}).get("projectStatus", {}).get("status", "unavailable")
    manifest = {
        "project": PROJECT,
        "generated_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "authenticated": bool(TOKEN),
        "quality_gate": gate,
        "issues_retrieved": len(issues),
        "hotspots_retrieved": results.get("hotspots", {}).get("retrieved"),
        "warnings": warnings,
        "errors": errors,
    }
    save("manifest.json", manifest)

    lines = [
        f"# SonarQube Cloud audit: {PROJECT}", "",
        f"- Quality Gate: **{gate}**",
        f"- Authentication: {'token configured' if TOKEN else 'anonymous'}",
        f"- Issues: **{len(issues)}** / {results.get('issues', {}).get('total', 'unknown')}",
        f"- Security Hotspots: **{results.get('hotspots', {}).get('retrieved', 'unknown')}**",
        "",
        "| Metric | Value |", "|---|---|",
    ]
    for key in ("security_rating", "reliability_rating", "sqale_rating", "new_security_rating", "new_reliability_rating", "new_maintainability_rating", "coverage", "new_coverage", "duplicated_lines_density"):
        val = metrics.get(key, "—")
        display = grade(val) if "rating" in key else val
        lines.append(f"| {key} | {display} |")
    lines.extend(["", "## Highest-severity findings", "",
                  "| Severity | Quality | Rule | Location | Description |",
                  "|---|---|---|---|---|"])
    def worst(issue):
        impact_scores = [SEVERITIES.get(impact.get("severity"), 0) for impact in issue.get("impacts", [])]
        return max(impact_scores + [SEVERITIES.get(issue.get("severity"), 0)])
    for issue in sorted(issues, key=worst, reverse=True)[:30]:
        impacts = issue.get("impacts", [])
        quality = ", ".join(sorted({i.get("softwareQuality", "") for i in impacts})) or issue.get("type")
        severity = max((i.get("severity", "") for i in impacts), key=lambda v: SEVERITIES.get(v, 0), default=issue.get("severity"))
        location = issue.get("component", "").replace(PROJECT + ":", "")
        if issue.get("line"):
            location += f":{issue['line']}"
        lines.append(f"| {escape_table(severity)} | {escape_table(quality)} | {escape_table(issue.get('rule'))} | {escape_table(location)} | {escape_table(issue.get('message'))} |")
    if not issues:
        lines.append("| — | — | — | — | No issue records returned |")
    if warnings:
        lines.extend(["", "## Incomplete data", *[f"- {warning}" for warning in warnings]])
    if errors:
        lines.extend(["", "## Export errors", *[f"- {error}" for error in errors]])
    (OUTPUT / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as file:
            file.write("\n".join(lines) + "\n")
    if errors or warnings:
        print("Export failed or incomplete; inspect sonarcloud-report/summary.md and manifest.json", file=sys.stderr)
        return 1
    print(f"Successfully exported {len(issues)} issues and quality metrics for {PROJECT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
