#!/usr/bin/env bash
set -euo pipefail

source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
app_dir="${1:-$HOME/ExpenseTrackerTest}"
config="$app_dir/xtool.yml"

if [[ ! -f "$config" || ! -d "$app_dir/Sources/ExpenseTrackerTest" ]]; then
  echo "Не найден xtool-проект ExpenseTrackerTest: $app_dir" >&2
  echo "Укажи каталог проекта: bash ios/SpendTracker/install.sh /путь/к/проекту" >&2
  exit 1
fi

mkdir -p "$app_dir/Resources"
cp "$source_dir/ContentView.swift" "$app_dir/Sources/ExpenseTrackerTest/ContentView.swift"
cp "$source_dir/Resources/AppIcon.png" "$app_dir/Resources/AppIcon.png"
cp "$source_dir/Info.plist" "$app_dir/Resources/Info.plist"

python3 - "$config" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()
for key, value in (("infoPath", "Resources/Info.plist"), ("iconPath", "Resources/AppIcon.png")):
    line = f"{key}: {value}"
    pattern = rf"(?m)^\s*{key}\s*:\s*.*$"
    if re.search(pattern, text):
        text = re.sub(pattern, line, text, count=1)
    else:
        text = text.rstrip() + "\n" + line + "\n"
path.write_text(text)
PY

echo "iOS-оболочка, иконка и разрешения добавлены в: $app_dir"
echo "Проверь xtool.yml: прежний bundleID должен остаться без изменений."
