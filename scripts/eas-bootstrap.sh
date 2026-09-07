#!/usr/bin/env bash
# Links this checkout to an EAS project when app.json still carries the
# placeholder ids, so a fresh clone can build with nothing but an EXPO_TOKEN
# secret — no local Expo CLI, no `eas init` on someone's laptop.
#
# `eas init` creates the project the first time and links to the existing one
# by slug on every run after, so this is safe to run on every build. Once the
# real ids are committed it does nothing at all.
set -euo pipefail

PLACEHOLDER='REPLACE_WITH_YOUR_EAS_PROJECT_ID'

if ! grep -q "$PLACEHOLDER" app.json; then
  echo "app.json already names a real EAS project — nothing to link."
  exit 0
fi

if ! command -v eas >/dev/null 2>&1; then
  echo "eas-cli is not on PATH. In CI that comes from expo/expo-github-action;" >&2
  echo "locally, install it with 'npm i -g eas-cli' or run 'npx eas-cli init'." >&2
  exit 1
fi

eas init --force --non-interactive

# `eas init` writes extra.eas.projectId and leaves updates.url alone. The two
# have to name the same project or updates are published where no build looks
# for them.
node -e '
const fs = require("fs");
const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
const id = app.expo?.extra?.eas?.projectId;
if (!id || id.startsWith("REPLACE")) {
  console.error("eas init did not write a project id");
  process.exit(1);
}
app.expo.updates = { ...app.expo.updates, url: `https://u.expo.dev/${id}` };
fs.writeFileSync("app.json", JSON.stringify(app, null, 2) + "\n");
console.log(`::notice::Linked to EAS project ${id}. Commit that id into app.json (both places) to skip this step in future runs.`);
'
