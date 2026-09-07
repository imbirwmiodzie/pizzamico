#!/usr/bin/env bash
# One-time push of this project to GitHub.
#
# Run it from inside this folder while the Mac has internet:
#   ./push.sh
#
# It creates the git repo, makes the first commit, and pushes to `main`.
# Nothing here stores a credential — git will ask, or use whatever you have
# already configured (SSH key, credential helper, or gh auth).

set -euo pipefail

REMOTE="${1:-https://github.com/imbirwmiodzie/pizzamico.git}"

cd "$(dirname "$0")"

if [ ! -d .git ]; then
  git init -q
  git branch -M main
fi

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit — the working tree matches the last commit."
else
  git commit -q -m "Pizza Voice Timer: Expo port of the designer handoff

Kotlin/Compose build ported to Expo (SDK 57). The countdown rules and the
voice-command parser are pure TypeScript and unit-tested; the audio cues run
in an Android foreground service driven by an absolute end timestamp, so the
halfway 'GIRA!' and the final shout land on time with the app backgrounded.

CI is split so JS changes ship over the air and only native changes spend one
of the fifteen monthly EAS builds."
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REMOTE"
else
  git remote set-url origin "$REMOTE"
fi

echo "Pushing to $REMOTE …"
git push -u origin main

cat <<'NEXT'

Pushed. Two things left before the first build:

  1. expo.dev → account settings → access tokens → create one.
  2. GitHub repo → Settings → Secrets and variables → Actions →
     New repository secret, named exactly EXPO_TOKEN.

Then run `npx eas init` here once (it fills in the two REPLACE_WITH_YOUR_EAS_PROJECT_ID
placeholders in app.json), commit that, and push. The build workflow takes it
from there — the APK link appears on your project's build page at expo.dev.
NEXT
