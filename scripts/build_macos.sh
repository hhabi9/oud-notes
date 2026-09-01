#!/bin/zsh
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"

if [[ ! -x .venv/bin/python ]]; then
  echo "Missing .venv. Create it and install requirements-desktop.txt first."
  exit 1
fi

icon_work="$(mktemp -d)"
dmg_stage="$(mktemp -d)"
cleanup() {
  rm -rf "$icon_work" "$dmg_stage"
}
trap cleanup EXIT

mkdir -p "$icon_work/OudNotes.iconset"
qlmanage -t -s 1024 -o "$icon_work" assets/OudNotes.svg >/dev/null 2>&1
source_icon="$icon_work/OudNotes.svg.png"

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$source_icon" --out "$icon_work/OudNotes.iconset/icon_${size}x${size}.png" >/dev/null
  double_size=$((size * 2))
  sips -z "$double_size" "$double_size" "$source_icon" --out "$icon_work/OudNotes.iconset/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$icon_work/OudNotes.iconset" -o assets/OudNotes.icns
.venv/bin/python -m PyInstaller --noconfirm --clean OudNotes.spec

cp -R "dist/Oud Notes.app" "$dmg_stage/"
ln -s /Applications "$dmg_stage/Applications"
hdiutil create -quiet -volname "Oud Notes" -srcfolder "$dmg_stage" -ov -format UDZO "dist/Oud Notes.dmg"

echo "Built dist/Oud Notes.app"
echo "Built dist/Oud Notes.dmg"
