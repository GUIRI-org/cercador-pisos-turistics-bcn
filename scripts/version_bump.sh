#!/bin/bash
#
# version_bump.sh
#
# Bumps the semantic version in VERSION, frontend package metadata, and CHANGELOG.md.
#
# Usage:
#   ./scripts/version_bump.sh patch         # 0.1.0 → 0.1.1
#   ./scripts/version_bump.sh minor         # 0.1.0 → 0.2.0
#   ./scripts/version_bump.sh patch --push  # bump, commit, and push release tag
#

set -euo pipefail

BUMP_TYPE="${1:-}"
PUSH_OPTION="${2:-}"
VERSION_FILE="VERSION"
CHANGELOG_FILE="CHANGELOG.md"
PACKAGE_FILE="frontend/next-app/package.json"
PACKAGE_LOCK_FILE="frontend/next-app/package-lock.json"

if [[ ! "$BUMP_TYPE" =~ ^(patch|minor)$ ]] || [[ $# -gt 2 ]] || [[ -n "$PUSH_OPTION" && "$PUSH_OPTION" != "--push" ]]; then
  echo "Usage: $0 <patch|minor> [--push]" >&2
  exit 1
fi

for FILE in "$VERSION_FILE" "$CHANGELOG_FILE" "$PACKAGE_FILE" "$PACKAGE_LOCK_FILE"; do
  if [ ! -f "$FILE" ]; then
    echo "Error: ${FILE} not found." >&2
    exit 1
  fi
done

if ! grep -q '^## Unreleased$' "$CHANGELOG_FILE"; then
  echo "Error: '## Unreleased' heading not found in ${CHANGELOG_FILE}." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Read and bump version
# ---------------------------------------------------------------------------
CURRENT_VERSION=$(head -1 "$VERSION_FILE" | tr -d '[:space:]')

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

if [ "$BUMP_TYPE" = "patch" ]; then
  PATCH=$((PATCH + 1))
elif [ "$BUMP_TYPE" = "minor" ]; then
  MINOR=$((MINOR + 1))
  PATCH=0
fi

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

# ---------------------------------------------------------------------------
# 2. Prepare changelog date
# ---------------------------------------------------------------------------
DAY=$(LC_ALL=C date +%d)
DAY="${DAY#0}"
MONTH=$(LC_ALL=C date +%B)
YEAR=$(LC_ALL=C date +%Y)

case "$DAY" in
  1|21|31) SUFFIX="st" ;;
  2|22)    SUFFIX="nd" ;;
  3|23)    SUFFIX="rd" ;;
  *)       SUFFIX="th" ;;
esac

DATE_STR="${DAY}${SUFFIX} of ${MONTH} ${YEAR}"

# ---------------------------------------------------------------------------
# 3. Update frontend package metadata and changelog
# ---------------------------------------------------------------------------
node - "$NEW_VERSION" "$DATE_STR" "$PACKAGE_FILE" "$PACKAGE_LOCK_FILE" "$CHANGELOG_FILE" <<'NODE'
const fs = require("fs");
const [version, dateString, packageFile, lockFile, changelogFile] = process.argv.slice(2);
const packageData = JSON.parse(fs.readFileSync(packageFile, "utf8"));
const lockData = JSON.parse(fs.readFileSync(lockFile, "utf8"));
const changelog = fs.readFileSync(changelogFile, "utf8");
const updatedChangelog = changelog.replace(
  /^## Unreleased$/m,
  `## Unreleased\n\n## v${version} - ${dateString}`
);

if (updatedChangelog === changelog) {
  throw new Error(`'## Unreleased' heading not found in ${changelogFile}`);
}

packageData.version = version;
lockData.version = version;
if (lockData.packages && lockData.packages[""]) {
  lockData.packages[""].version = version;
}

fs.writeFileSync(packageFile, `${JSON.stringify(packageData, null, 2)}\n`);
fs.writeFileSync(lockFile, `${JSON.stringify(lockData, null, 2)}\n`);
fs.writeFileSync(changelogFile, updatedChangelog);
NODE

# ---------------------------------------------------------------------------
# 4. Write new version
# ---------------------------------------------------------------------------
echo "$NEW_VERSION" > "$VERSION_FILE"

# ---------------------------------------------------------------------------
# 5. Summary
# ---------------------------------------------------------------------------
echo ""
echo "Version bumped: ${CURRENT_VERSION} → ${NEW_VERSION}"
echo ""
echo "Files changed:"
echo "  ${VERSION_FILE}"
echo "  ${CHANGELOG_FILE}"
echo "  ${PACKAGE_FILE}"
echo "  ${PACKAGE_LOCK_FILE}"
echo ""

if [[ "$PUSH_OPTION" == "--push" ]]; then
  git add "$VERSION_FILE" "$CHANGELOG_FILE" "$PACKAGE_FILE" "$PACKAGE_LOCK_FILE"
  git commit -m "chore: bump version to v${NEW_VERSION}"
  git push
  git tag "v${NEW_VERSION}"
  git push origin "v${NEW_VERSION}"
else
  echo "Next steps:"
  echo "  git add VERSION CHANGELOG.md ${PACKAGE_FILE} ${PACKAGE_LOCK_FILE}"
  echo "  git commit -m \"chore: bump version to v${NEW_VERSION}\""
  echo "  git push"
  echo "  git tag v${NEW_VERSION}"
  echo "  git push origin v${NEW_VERSION}"
fi
