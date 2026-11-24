#!/bin/bash
# 地圖分頁的縣市界線：簡化成只留轉折的特徵點，線比較乾淨（做法參考 birth-lottery 的世界地圖 scripts/simplify_world.mjs）。
# 用 mapshaper：先把相鄰縣市的邊界對齊成同一條線再簡化（Douglas–Peucker），所以簡化後兩邊還是同一條線，不會裂開或重疊。
# 用法：bash scripts/simplify_counties.sh [容許誤差（公尺，預設 1800）] [比這個小的島不畫（平方公里，預設 3）]
# 讀 data/boundary/county-2010.geojson（2010-12-25 縣市合併前的 25 個縣市；原始檔不動）
# → 寫 src/data/county-2010.json（合併前）、src/data/county-now.json（現在的 22 縣市：把臺中、臺南、高雄的縣、市合起來，
#   所以沒有合併的縣市在兩份裡的形狀一模一樣，時間跨過 2010 年時不會跳一下）
set -euo pipefail
cd "$(dirname "$0")/.."
TOL="${1:-1800}"
ISLAND="${2:-3}"
SRC=data/boundary/county-2010.geojson
npx --yes mapshaper@0.6 "$SRC" snap \
  -simplify dp interval="$TOL" keep-shapes \
  -filter-islands min-area="${ISLAND}km2" \
  -clean \
  -o src/data/county-2010.json format=geojson precision=0.0001
npx --yes mapshaper@0.6 src/data/county-2010.json \
  -each 'COUNTYNAME = COUNTYNAME.replace("（合併前）", "").replace(/^(臺中|臺南|高雄)縣$/, "$1市")' \
  -dissolve COUNTYNAME \
  -o src/data/county-now.json format=geojson precision=0.0001
