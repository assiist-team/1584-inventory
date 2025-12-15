#!/usr/bin/env bash
set -euo pipefail

# Fail if any occurrence of "navigationStack.push(" exists outside the allowlist.
# Allowlist:
#  - src/hooks/useStackedNavigate.ts
#  - src/components/ContextLink.tsx
#  - src/contexts/NavigationStackContext.tsx
#  - test files (__tests__, *.test.*, *.spec.*)

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root_dir"

echo "Checking for forbidden navigationStack.push usages (scanning src/ and tests only)..."

# Search src/ (and tests under src) for occurrences only
matches=$(grep -R --line-number --binary-files=without-match "navigationStack.push(" src/ || true)

if [ -z "$matches" ]; then
  echo "No occurrences found."
  exit 0
fi

# Filter out allowlist paths
filtered=$(printf "%s\n" "$matches" \
  | grep -vE "src/hooks/useStackedNavigate\\.ts(:|$)" \
  | grep -vE "src/components/ContextLink\\.tsx(:|$)" \
  | grep -vE "src/contexts/NavigationStackContext\\.tsx(:|$)" \
  | grep -vE "\\/__tests__\\/|__tests__|\\.test\\.|\\.spec\\." || true)

if [ -n "$filtered" ]; then
  echo "ERROR: Forbidden navigationStack.push usage found outside allowed files:"
  echo ""
  echo "$filtered"
  echo ""
  echo "Allowed files:"
  echo "  - src/hooks/useStackedNavigate.ts"
  echo "  - src/components/ContextLink.tsx"
  echo "  - src/contexts/NavigationStackContext.tsx"
  echo "  - test files (__tests__, *.test.*, *.spec.*)"
  exit 1
fi

echo "All navigationStack.push usages are within the allowlist."
exit 0


