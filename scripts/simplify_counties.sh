#!/bin/bash
# 地圖分頁的縣市界線：簡化成只留轉折的特徵點，線比較乾淨（做法參考 birth-lottery 的世界地圖 scripts/simplify_world.mjs）。
# 用 mapshaper：先把相鄰縣市的邊界對齊成同一條線再簡化，所以簡化後兩邊還是同一條線，不會裂開或重疊。
# 簡化用 Visvalingam（加權）：照「拿掉這個點少掉多少面積」決定去留，小鋸齒會整段抹平，整張圖的線條粗細程度一致。
# （原本用 Douglas–Peucker：只看離直線多遠，山區彎彎曲曲的縣界會留下一堆小鋸齒，海岸卻被拉成直線，看起來一段曲一段直。）
# 用法：bash scripts/simplify_counties.sh [簡化程度（公尺，越大越簡單，預設 2600）] [比這個小的島不畫（平方公里，預設 3）]
# 讀 data/boundary/town.geojson（鄉鎮市區界；原始檔不動）
# → 寫 src/data/county-2010.json（合併前）、src/data/county-now.json（現在的 22 縣市：把臺中、臺南、高雄的縣、市合起來，
#   所以沒有合併的縣市在兩份裡的形狀一模一樣，時間跨過 2010 年時不會跳一下）
set -euo pipefail
cd "$(dirname "$0")/.."
TOL="${1:-2600}"
ISLAND="${2:-3}"
# 來源：鄉鎮市區界（data/boundary/town.geojson，內政部國土測繪中心）。先照 2010-12-25 縣市合併前的 25 個縣市把鄉鎮合起來
# （臺中、臺南、高雄的舊市＝下面列的那幾區，其他鄉鎮＝舊縣）。全部從同一份鄉鎮界合出來，相鄰縣市的邊界才是同一條線，
# 簡化的時候兩邊一起簡化；不然（之前用另外合成的檔）臺中、嘉義、高雄一帶的邊界對不起來，那幾段會簡化不下去
TOWNS=data/boundary/town.geojson
SRC="$(mktemp -d)/county-2010.json"
npx --yes mapshaper@0.6 "$TOWNS" snap \
  -each 'OLD = { "臺中市": ["中區","東區","南區","西區","北區","北屯區","西屯區","南屯區"], "臺南市": ["中西區","東區","南區","北區","安平區","安南區"], "高雄市": ["鹽埕區","鼓山區","左營區","楠梓區","三民區","新興區","前金區","苓雅區","前鎮區","旗津區","小港區"] }, C = COUNTYNAME, city = OLD[C] && OLD[C].includes(TOWNNAME), COUNTYNAME = !OLD[C] ? C : city ? C + "（合併前）" : C.slice(0, 2) + "縣", NAME = !OLD[C] ? ({ "新北市": "臺北縣", "桃園市": "桃園縣" }[C] || C) : city ? C : C.slice(0, 2) + "縣"' \
  -dissolve COUNTYNAME copy-fields=NAME \
  -o "$SRC" format=geojson
# 外島三縣（連江、金門、澎湖）在地圖上是另外放大畫在小框裡的，島又小：用細很多的程度簡化，不然會被簡化成一個三角形。
# 它們跟本島的縣市沒有共用的邊界，分開簡化再合起來沒問題
OUT_ISLANDS='["連江縣","金門縣","澎湖縣"].includes(COUNTYNAME)'
TMP="$(mktemp -d)"
npx --yes mapshaper@0.6 "$SRC" snap \
  -filter "!$OUT_ISLANDS" \
  -simplify weighted interval="$TOL" keep-shapes \
  -filter-islands min-area="${ISLAND}km2" \
  -clean \
  -o "$TMP/main.json" format=geojson precision=0.0001
npx --yes mapshaper@0.6 "$SRC" snap \
  -filter "$OUT_ISLANDS" \
  -simplify weighted interval="$((TOL / 8))" keep-shapes \
  -filter-islands min-area=0.4km2 \
  -clean \
  -o "$TMP/islands.json" format=geojson precision=0.0001
npx --yes mapshaper@0.6 -i "$TMP/main.json" "$TMP/islands.json" combine-files \
  -merge-layers \
  -o src/data/county-2010.json format=geojson precision=0.0001
npx --yes mapshaper@0.6 src/data/county-2010.json \
  -each 'COUNTYNAME = COUNTYNAME.replace("（合併前）", "").replace(/^(臺中|臺南|高雄)縣$/, "$1市")' \
  -dissolve COUNTYNAME \
  -o src/data/county-now.json format=geojson precision=0.0001
