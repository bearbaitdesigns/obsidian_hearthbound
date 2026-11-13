#!/usr/bin/env python3
"""Bumps the plugin version: python3 .github/scripts/bump.py patch|minor|major|X.Y.Z
Updates manifest.json and versions.json (version -> minAppVersion) and prints the new version."""
import json, re, sys

arg = (sys.argv[1] if len(sys.argv) > 1 else "patch").strip()
with open("manifest.json") as f:
    manifest = json.load(f)
major, minor, patch = (int(x) for x in manifest["version"].split("."))
if re.fullmatch(r"\d+\.\d+\.\d+", arg):
    new = arg
elif arg == "major":
    new = f"{major + 1}.0.0"
elif arg == "minor":
    new = f"{major}.{minor + 1}.0"
elif arg == "patch":
    new = f"{major}.{minor}.{patch + 1}"
else:
    sys.exit(f"Unknown bump '{arg}' — use patch, minor, major or X.Y.Z")
manifest["version"] = new
with open("manifest.json", "w") as f:
    json.dump(manifest, f, indent=2); f.write("\n")
try:
    with open("versions.json") as f:
        versions = json.load(f)
except FileNotFoundError:
    versions = {}
versions[new] = manifest["minAppVersion"]
with open("versions.json", "w") as f:
    json.dump(versions, f, indent=2); f.write("\n")
print(new)
