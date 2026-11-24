<template>
  <!-- 地圖分頁：左邊是跟編年表一樣的時間軸（年份、總統、大事），在上面點、拖選一天；右邊的臺灣地圖畫那一天各縣市的首長（顏色＝黨籍） -->
  <div class="pane">
    <div class="toolbar">
      <div class="ctl" role="toolbar" aria-label="工具列">
        <ModeTabs />
        <div class="tb-grp" role="group" aria-label="時間">
          <button type="button" class="btn btn-sm btn-tb" title="上一次首長變動（←）" :disabled="!prevDay" @click="go(prevDay)"><span class="material-symbols-outlined">skip_previous</span></button>
          <button type="button" class="btn btn-sm btn-tb" :class="{ active: playing }" :aria-pressed="playing" title="播放／暫停（空白鍵）" @click="toggle"><span class="material-symbols-outlined">{{ playing ? 'pause' : 'play_arrow' }}</span><span class="lbl">{{ playing ? '暫停' : '播放' }}</span></button>
          <button type="button" class="btn btn-sm btn-tb" title="下一次首長變動（→）" :disabled="!nextDay" @click="go(nextDay)"><span class="material-symbols-outlined">skip_next</span></button>
          <span class="day">{{ ymd(date) }}</span>
        </div>
        <div class="vr"></div>
        <div class="tb-grp" role="group" aria-label="地圖上顯示什麼">
          <button v-for="[k, l] in SHOW" :key="k" type="button" class="btn btn-sm btn-tb" :class="{ active: show[k] }" :aria-pressed="show[k]" :title="`顯示${l}`" @click="show[k] = !show[k]">{{ l }}</button>
        </div>
        <div class="vr"></div>
        <button type="button" class="btn btn-sm btn-tb" title="回到現在（資料截止日）" :disabled="date === H.asOf && !playing" @click="go(H.asOf)"><span class="material-symbols-outlined">restart_alt</span><span class="lbl">回到現在</span></button>
      </div>
    </div>

    <div ref="split" class="split">
      <!-- 左：時間軸（跟編年表左邊凍結的三欄一樣），整段剛好一頁高；點、拖＝選日期 -->
      <div class="taxis" :class="{ scrubbing }" :style="{ width: `${AXIS}px` }">
        <div class="thead" :style="{ height: `${HEAD}px` }">
          <div class="head" :style="{ left: 0, width: `${YEAR_W}px` }"><b>年</b></div>
          <div class="head" :style="{ left: `${YEAR_W}px`, width: `${PRES_W}px` }"><b>總統</b></div>
          <div v-if="EV_W" class="head" :style="{ left: `${YEAR_W + PRES_W}px`, width: `${EV_W}px` }"><b>大事</b></div>
        </div>
        <div ref="tbody" class="tbody" @pointerdown="onScrub" @pointermove="onScrub" @pointerup="endScrub" @pointercancel="endScrub" @mousemove="onPresHover" @mouseleave="tip?.sheet || (tip = null)">
          <span v-for="y in ticks" :key="y" class="year" :title="y" :style="{ top: `${(y - Y0) * py}px`, width: `${YEAR_W}px` }">’{{ String(y).slice(2) }}</span>
          <div v-for="(p, i) in pres" :key="p.name" class="blk" :aria-label="p.tip" :data-p="i" :style="{ left: `${YEAR_W + 2}px`, width: `${PRES_W - 4}px`, top: `${p.a * py}px`, height: `${p.h}px`, backgroundColor: COLOR[p.party] }">
            <i v-for="c in p.cuts" :key="c" class="cut" :style="{ top: `${c * py}px` }"></i>
            <span v-if="p.h >= 11"><b>{{ p.name }}</b><em v-if="!p.end" class="now">現任</em><small v-if="p.h >= 27">{{ ymd(p.start) }}</small><small v-if="p.h >= 36">{{ ymd(p.end ?? H.asOf, H.asOf) }}</small></span>
          </div>
          <svg v-if="EV_W" class="leads" :style="{ left: `${YEAR_W + PRES_W}px` }" width="12" height="1"><path v-for="e in events" :key="e.date + e.label" :d="`M1 ${e.y * py}L9 ${e.ly}`" /></svg>
          <div v-for="e in (EV_W ? events : [])" :key="e.date + e.label" class="ev" :class="[e.kind, { past: e.date > date }]" :title="e.tip" :style="{ left: `${YEAR_W + PRES_W}px`, top: `${e.ly}px` }"><small>{{ ymd(e.date) }}</small>{{ e.label }}</div>
          <!-- 選到的那一天 -->
          <div class="phead" :class="{ low: (tv - Y0) * py > size.th - 12, high: (tv - Y0) * py < 12 }" :style="{ top: `${Math.min(size.th - 1, (tv - Y0) * py)}px` }"><span>{{ ymd(date) }}</span></div>
        </div>
      </div>

      <!-- 右：地圖 -->
      <div ref="mapEl" class="map" :class="{ tiny }">
        <svg :width="size.w" :height="size.h" @mousemove="onMapHover" @mouseleave="hotKey = null, tip?.sheet || (tip = null)" @click="onMapClick">
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="rgba(14, 14, 15, 0.4)" /></pattern>
            <!-- 縣市的立體感（浮雕）：朝左上的邊緣一條白邊、朝右下的邊緣一條黑影，都畫在形狀裡面。
                 每個縣市先往裡縮 0.5px：相鄰兩個縣市之間就有 1px 的間隙（跟編年表格子上下之間一樣）。
                 做法：形狀往右下移一點，原本有、移過後沒有的那一圈＝左上的邊（塗白）；往左上移＝右下的邊（塗黑）；各糊一點再裁回形狀裡 -->
            <filter id="bevel" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
              <feMorphology in="SourceGraphic" operator="erode" radius="0.5" result="shape" />
              <feOffset in="shape" dx="1" dy="1" result="toSE" />
              <feComposite in="shape" in2="toSE" operator="out" result="edgeNW" />
              <feGaussianBlur in="edgeNW" stdDeviation="0.5" result="edgeNWb" />
              <feFlood flood-color="#fff" flood-opacity="0.32" />
              <feComposite in2="edgeNWb" operator="in" result="light" />
              <feOffset in="shape" dx="-1.2" dy="-1.2" result="toNW" />
              <feComposite in="shape" in2="toNW" operator="out" result="edgeSE" />
              <feGaussianBlur in="edgeSE" stdDeviation="0.6" result="edgeSEb" />
              <feFlood flood-color="#000" flood-opacity="0.28" />
              <feComposite in2="edgeSEb" operator="in" result="dark" />
              <feMerge result="both"><feMergeNode in="dark" /><feMergeNode in="light" /></feMerge>
              <feComposite in="both" in2="shape" operator="in" result="inside" />
              <feMerge><feMergeNode in="shape" /><feMergeNode in="inside" /></feMerge>
            </filter>
            <!-- 只縮 0.5px（非民選的斜線那一層用，才不會蓋到間隙） -->
            <filter id="gap"><feMorphology operator="erode" radius="0.5" /></filter>
          </defs>
          <!-- 外島三縣的小框（左上角）：連江、金門、澎湖 -->
          <g v-for="b in layout.boxes" :key="b.name" class="inset">
            <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="6" />
          </g>
          <!-- 整塊陸地下面一圈黑影：浮在底上 -->
          <g class="land">
            <g v-for="s in shapes" :key="s.key" class="county" :class="{ sub: s.sub, none: !s.run }" :data-k="s.key">
              <path :d="s.d" :fill="s.fill" :filter="s.sub ? null : 'url(#bevel)'" />
              <path v-if="s.run?.note" :d="s.d" fill="url(#hatch)" class="over" filter="url(#gap)" />
            </g>
          </g>
          <!-- 滑鼠移到的那個縣市：在所有縣市上面再畫一份，放大、變亮、浮起來（跟格子一樣；直接放大原本那一份會被旁邊的縣市蓋住） -->
          <g v-if="hot" :key="hot.key" class="lift">
            <path :d="hot.d" :fill="hot.fill" filter="url(#bevel)" />
            <path v-if="hot.run?.note" :d="hot.d" fill="url(#hatch)" filter="url(#gap)" />
          </g>
          <!-- 字畫在所有縣市上面 -->
          <g v-for="s in shapes" :key="s.key" class="label">
            <text v-if="!s.sub && (unitOn || show.name)" :x="s.x" :y="s.y">
              <tspan v-if="unitOn" class="unit" :x="s.x">{{ s.unit }}</tspan>
              <tspan v-if="show.name && s.run" class="name" :x="s.x" :dy="unitOn ? '1.15em' : 0">{{ s.run.name }}<tspan v-if="s.tag" class="tag" dx="2">{{ s.tag }}</tspan></tspan>
            </text>
          </g>
        </svg>
        <!-- 右上角：那一天的總統、各黨幾個縣市 -->
        <div class="sum">
          <div class="sum-day">{{ ymd(date) }}</div>
          <div v-if="president" class="sum-row"><i :style="{ background: COLOR[president.party] }"></i>總統 {{ president.name }}</div>
          <div class="sum-tally">
            <span v-for="p in tally" :key="p.key"><i :style="{ background: p.color }"></i>{{ p.label }} <b>{{ p.n }}</b></span>
          </div>
        </div>
      </div>
    </div>

    <TipCard :tip="tip" @close="tip = null" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { geoMercator, geoPath } from 'd3-geo'
import TipCard from './TipCard.vue'
import ModeTabs from './ModeTabs.vue'
import NOW from './data/county-now.json'
import OLD from './data/county-2010.json'
import { COLOR, MERGED, MERGE_DAY, UNKNOWN, colorOf, yr, ymd } from './parties.js'
import { EVS, H, PRES, RUNS, Y0, Y1, fromYr, loadPhotos, presTip, termTags, termTip, termUrl, tipPos } from './shared.js'

const YEAR_W = 28, HEAD = 40 // 年份欄的寬、欄名那一列的高（跟編年表一樣）
const NARROW = 720 // 畫面比這個窄＝手機版面
const PLAIN = '#48484a' // 不顯示政黨色時的顏色
const VACANT = '#232325' // 那一天沒有首長（出缺、維基沒有資料）
const SPEED = 2.5 // 播放：一秒走幾年
const CITY_SINCE = '1982-07-01' // 新竹市、嘉義市升格省轄市；之前是縣轄市，算在新竹縣、嘉義縣裡
const SHOW = [['unit', '縣市名'], ['name', '市長名'], ['color', '政黨色']]
const show = reactive({ unit: true, name: true, color: true })

// ── 選到的那一天：tv＝年（小數），date＝日期
const tv = ref(Y1)
const date = computed(() => (tv.value >= Y1 ? H.asOf : fromYr(Math.max(Y0, tv.value))))
const go = (d) => { playing.value = false; tv.value = Math.min(Y1, Math.max(Y0, yr(d))) }
// 首長有變動的日子（每一段任期的就任日）：上一次、下一次
const CHANGES = [...new Set(Object.values(RUNS).flatMap((r) => r.map((t) => t.start)))].filter((d) => yr(d) > Y0).sort()
const prevDay = computed(() => CHANGES.findLast((d) => d < date.value))
const nextDay = computed(() => CHANGES.find((d) => d > date.value))
// 播放：從選到的那一天往後走，到現在停；已經在最後就從頭
const playing = ref(false)
let raf = 0, last = 0
function step(now) {
  if (!playing.value) return (raf = 0)
  tv.value = Math.min(Y1, tv.value + ((now - last) / 1000) * SPEED)
  last = now
  if (tv.value >= Y1) playing.value = false
  raf = requestAnimationFrame(step)
}
function toggle() {
  playing.value = !playing.value
  if (!playing.value) return
  if (tv.value >= Y1) tv.value = Y0
  last = performance.now()
  if (!raf) raf = requestAnimationFrame(step)
}

// ── 左邊的時間軸
const split = ref(null), tbody = ref(null), mapEl = ref(null)
const size = reactive({ w: 800, h: 600, page: 1200, th: 600 }) // 地圖的寬高、整頁的寬、時間軸的高
const compact = computed(() => size.page < NARROW)
const tiny = computed(() => size.h < 320) // 地圖很小（手機橫放）：字縮小，縣市名和首長名都開時只寫首長名
const unitOn = computed(() => show.unit && !(tiny.value && show.name))
const PRES_W = computed(() => (compact.value ? 48 : 60)), EV_W = computed(() => (compact.value ? 0 : 138))
const AXIS = computed(() => YEAR_W + PRES_W.value + EV_W.value)
const py = computed(() => size.th / (Y1 - Y0)) // 一年幾 px
const ticks = computed(() => {
  const step = py.value >= 20 ? 1 : py.value >= 8 ? 2 : 5
  const out = []
  for (let v = Math.ceil(Y0 / step) * step; v <= Y1; v += step) out.push(v)
  return out
})
const pres = computed(() => PRES.map((p) => ({ ...p, h: Math.max(1, (p.b - p.a) * py.value - 1) })))
const events = computed(() => {
  let prev = -99
  return EVS.map((e) => ({ ...e, ly: (prev = Math.max(e.y * py.value, prev + 13)) }))
})
const president = computed(() => PRES.find((p) => p.start <= date.value && (date.value < (p.end ?? '9999') )))
// 在時間軸上點、拖＝選那一天
const scrubbing = ref(false)
function onScrub(e) {
  if (e.type === 'pointerdown') {
    if (e.button !== 0) return
    scrubbing.value = true
    playing.value = false
    tip.value = null
    tbody.value.setPointerCapture(e.pointerId)
  }
  if (!scrubbing.value) return
  const y = e.clientY - tbody.value.getBoundingClientRect().top
  tv.value = Math.min(Y1, Math.max(Y0, Y0 + y / py.value))
}
const endScrub = () => (scrubbing.value = false)

// ── 地圖
// 兩份界線：現在的 22 縣市；2010-12-25 縣市合併前的（臺中、臺南、高雄拆回縣、市）。離本島太遠的小島（東沙、南沙、釣魚臺、烏坵）不畫
const INSETS = ['連江縣', '金門縣', '澎湖縣'] // 外島三縣：另外畫在左上角的小框裡（照這個順序）
const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
// d3-geo 要外圈順時針、洞逆時針（反過來會當成「整個地球扣掉這一塊」，整張圖被塗滿）；簡化後的檔案方向相反，這裡轉正
const area2 = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a }
const wind = (poly) => poly.map((r, i) => ((area2(r) > 0) === (i === 0) ? r.slice().reverse() : r))
function prep(fc) {
  return fc.features.map((f) => {
    const key = f.properties.COUNTYNAME, group = INSETS.includes(key) ? key : 'main'
    const keep = polys(f.geometry).map(wind).filter((p) => {
      const xs = p[0].map((c) => c[0]), ys = p[0].map((c) => c[1])
      const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2
      return group === 'main' ? x > 119.1 && x < 122.3 && y > 21.7 && y < 25.7 : group === '金門縣' ? x < 118.7 : true
    })
    // 這塊地在資料裡是哪個縣市（county）、合併前的哪一邊（unit：臺中縣／臺中市）
    const old = key.endsWith('（合併前）'), side = !old && key.endsWith('縣') && MERGED.includes(`${key.slice(0, 2)}市`)
    return { key, group, name: f.properties.NAME ?? key, county: old ? key.slice(0, 3) : side ? `${key.slice(0, 2)}市` : key, unit: old ? key.slice(0, 3) : side ? key : null, geometry: { type: 'MultiPolygon', coordinates: keep } }
  })
}
const GEO = { now: prep(NOW), old: prep(OLD) }
// 字的位置微調（px，照地圖大小縮放）：擠在一起的縣市錯開
const NUDGE = { 基隆市: [26, -14], 臺北市: [-4, -8], 新北市: [16, 30], 新竹市: [-30, -8], 嘉義市: [-34, 2], '臺中市（合併前）': [-24, 2], '臺南市（合併前）': [-26, 6], '高雄市（合併前）': [-28, 10] }
// 畫面大小 → 投影、每個縣市的路徑和字的位置（兩份界線都先算好）
const layout = computed(() => {
  const { w, h } = size, pad = 16, k = Math.min(1.4, Math.max(0.5, h / 800))
  const fc = (list) => ({ type: 'FeatureCollection', features: list.map((s) => ({ type: 'Feature', geometry: s.geometry })) })
  const main = geoMercator().fitExtent([[pad, pad], [w - pad, h - pad]], fc(GEO.now.filter((s) => s.group === 'main')))
  // 外島三縣的小框：左上角（本島西北邊是海）
  // 三個直排；畫面矮（手機橫放）就一起縮小到排得下
  const bh = Math.round(Math.min(Math.min(130, w * 0.24) * 0.72, (h - 24 - 20) / 3)), bw = Math.round(bh / 0.72)
  const boxes = INSETS.map((name, i) => ({ name, x: 12, y: 12 + i * (bh + 10), w: bw, h: bh }))
  const proj = { main }
  for (const b of boxes) proj[b.name] = geoMercator().fitExtent([[b.x + 8, b.y + 8], [b.x + b.w - 8, b.y + b.h - 22]], fc(GEO.now.filter((s) => s.group === b.name)))
  const build = (list) => list.map((s) => {
    const path = geoPath(proj[s.group]), box = boxes.find((b) => b.name === s.group)
    // 字放在最大那一塊的中心（離島的小框：框的下緣）
    const big = s.geometry.coordinates.map((c) => ({ type: 'Polygon', coordinates: c })).reduce((a, b) => (path.area(b) > path.area(a) ? b : a))
    const [cx, cy] = path.centroid(big), [dx, dy] = NUDGE[s.key] ?? [0, 0]
    return { ...s, d: path({ type: 'Feature', geometry: s.geometry }), x: box ? box.x + box.w / 2 : cx + dx * k, y: box ? box.y + box.h - (unitOn.value && show.name ? 17 : 8) : cy + dy * k - (unitOn.value && show.name ? 5 : 0) }
  })
  return { boxes, now: build(GEO.now), old: build(GEO.old) }
})
// 那一天誰在任
const runAt = (county, d, unit) => RUNS[county]?.find((t) => t.start <= d && (d < t.end || t.end === H.asOf) && (!unit || t.unit === unit))
// 代理：黨色壓暗（跟編年表一樣蓋 45% 的黑）
const dim = (hex) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.55 + [14, 14, 15][(i - 1) / 2] * 0.45).toString(16).padStart(2, '0')).join('')}`
const shapes = computed(() => {
  const d = date.value
  return layout.value[d >= MERGE_DAY ? 'now' : 'old'].map((s) => {
    // 新竹市、嘉義市升格前是縣轄市：跟著新竹縣、嘉義縣，不另外寫字
    const sub = (s.county === '新竹市' || s.county === '嘉義市') && d < CITY_SINCE
    const run = sub ? runAt(`${s.county.slice(0, 2)}縣`, d) : runAt(s.county, d, s.unit)
    const c = run ? (show.color ? colorOf(run) : PLAIN) : VACANT
    return { ...s, sub, run, fill: run?.acting ? dim(c) : c, unit: run?.unit ?? s.name, tag: run ? termTags(run).filter((g) => g !== '現任').join('・') : '' }
  })
})
// 各黨那一天有幾個縣市（代理、官派也算在那個人的黨）
const tally = computed(() => {
  const n = {}
  for (const s of shapes.value) if (!s.sub && s.run) n[s.run.party ?? ''] = (n[s.run.party ?? ''] ?? 0) + 1
  const label = Object.fromEntries(H.parties.map((p) => [p.key, p.label]))
  return Object.entries(n).map(([key, v]) => ({ key, n: v, label: label[key] ?? '黨籍不詳', color: COLOR[key] ?? UNKNOWN })).sort((a, b) => b.n - a.n)
})

// ── 資訊卡、點擊
const tip = ref(null)
const hotKey = ref(null) // 滑鼠移到哪個縣市
const hot = computed(() => shapes.value.find((s) => s.key === hotKey.value && s.run && !s.sub))
const shapeOf = (e) => { const k = e.target.closest?.('[data-k]')?.dataset.k; return k && shapes.value.find((s) => s.key === k) }
function onMapHover(e) {
  if (tip.value?.sheet) return // 觸控開的卡：留著
  const s = shapeOf(e)
  hotKey.value = s?.run ? s.key : null
  tip.value = s?.run ? termTip(s.run, tipPos(e)) : null
}
function onMapClick(e) {
  const s = shapeOf(e)
  // 觸控點縣市：先出資訊卡（卡上有開維基的按鈕）；點空白把卡收掉。滑鼠：直接開維基
  if (e.pointerType === 'touch' || e.pointerType === 'pen') tip.value = s?.run ? { ...termTip(s.run, {}), sheet: true } : null
  else if (s?.run) window.open(termUrl(s.run), '_blank', 'noopener')
}
function onPresHover(e) {
  if (tip.value?.sheet) return
  const el = scrubbing.value ? null : e.target.closest?.('[data-p]')
  tip.value = el ? presTip(PRES[el.dataset.p], tipPos(e)) : null
}
function onKey(e) {
  if (e.altKey || e.metaKey || e.ctrlKey || e.target.tagName === 'INPUT') return
  if (e.key === 'ArrowLeft' && prevDay.value) go(prevDay.value)
  else if (e.key === 'ArrowRight' && nextDay.value) go(nextDay.value)
  else if (e.key === ' ') toggle()
  else return
  e.preventDefault()
}

let ro
onMounted(() => {
  ro = new ResizeObserver(() => {
    const m = mapEl.value.getBoundingClientRect()
    if (!m.width) return
    size.w = Math.round(m.width), size.h = Math.round(m.height), size.page = split.value.clientWidth, size.th = tbody.value.clientHeight
  })
  ro.observe(split.value)
  ro.observe(mapEl.value)
  window.addEventListener('keydown', onKey)
  loadPhotos()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  playing.value = false
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.pane { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.day { min-width: 72px; margin-left: 4px; padding: 3px 8px; border-radius: 8px; background: var(--bg); color: var(--text); font-size: 13px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; }
.split { flex: 1; min-height: 0; display: flex; }

/* 左：時間軸（字級跟編年表 100% 一樣） */
.taxis { flex: none; display: flex; flex-direction: column; border-right: 1px solid var(--grid-strong); font-size: 11px; user-select: none; -webkit-user-select: none; }
.thead { flex: none; position: relative; background: var(--chrome); border-bottom: 1px solid var(--grid-strong); }
.tbody { flex: 1; min-height: 0; position: relative; overflow: hidden; cursor: ns-resize; touch-action: none; }
.tbody .blk { cursor: ns-resize; }
.taxis.scrubbing .blk { transition: none; transform: none; filter: none; box-shadow: none; }
.ev.past { opacity: 0.4; } /* 還沒發生的大事：淡掉 */
/* 選到的那一天：一條橫線＋日期 */
.phead { position: absolute; left: 0; right: 0; z-index: 3; height: 0; border-top: 2px solid var(--accent); pointer-events: none; filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.8)); }
.phead.low span { top: -17px; } /* 貼到最下面、最上面：日期往裡面收，不被切掉 */
.phead.high span { top: 0; }
.phead span { position: absolute; right: 0; top: -9px; padding: 1px 5px; border-radius: 6px 0 0 6px; background: var(--accent); color: var(--bg); font-size: 10px; font-weight: 700; line-height: 14px; font-variant-numeric: tabular-nums; }

/* 右：地圖 */
.map { flex: 1; min-width: 0; position: relative; overflow: hidden; background: radial-gradient(ellipse at 58% 45%, #1a1a1c 0, var(--bg) 70%); }
.map svg { display: block; }
.inset rect { fill: rgba(255, 255, 255, 0.035); stroke: var(--line); }
.land { filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)); }
.county path { cursor: pointer; transition: fill 0.25s; } /* 縣市之間不描線：每個縣市往裡縮 0.5px（濾鏡），中間留 1px 的間隙 */
.county .over { pointer-events: none; transition: none; }
.county.sub path { stroke: none; } /* 縣轄市時期的新竹市、嘉義市：併在縣裡，不畫界線 */
.county.none path { cursor: default; }
/* 滑鼠移上去：跟格子一樣放大 12%、變亮 15%、同樣的陰影、同樣 0.12 秒 */
.lift { pointer-events: none; transform-box: fill-box; transform-origin: center; transform: scale(1.12); filter: brightness(1.15) drop-shadow(0 8px 11px rgba(0, 0, 0, 0.6)); animation: lift 0.12s ease-out; }
@keyframes lift { from { transform: scale(1); filter: brightness(1) drop-shadow(0 0 0 rgba(0, 0, 0, 0)); } }
@media (hover: none) { .lift { display: none; } }
.label { pointer-events: none; }
.label text { text-anchor: middle; fill: #fff; paint-order: stroke; stroke: rgba(14, 14, 15, 0.85); stroke-width: 3px; stroke-linejoin: round; font-size: 12px; }
.label .unit { fill: #cdd3e0; font-size: 10px; }
.label .name { font-weight: 700; }
.map.tiny .label text { font-size: 9px; stroke-width: 2px; }
.map.tiny .sum { max-width: 170px; padding: 6px 8px; font-size: 11px; }
.map.tiny .sum-day { font-size: 16px; }
.label .tag { fill: var(--ev); font-size: 9px; font-weight: 500; }
/* 右上角的摘要 */
.sum { position: absolute; right: 12px; top: 12px; max-width: 240px; padding: 10px 12px; border: 1px solid #48484a; border-radius: 14px; background: rgba(44, 44, 46, 0.72); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); box-shadow: var(--shadow); font-size: 12px; line-height: 1.6; pointer-events: none; }
.sum-day { font-size: 24px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.sum-row { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.sum-tally { display: flex; flex-wrap: wrap; gap: 2px 10px; margin-top: 4px; }
.sum-tally span { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.sum i { flex: none; width: 10px; height: 10px; border-radius: 3px; }
.sum b { font-variant-numeric: tabular-nums; }
@media (max-width: 720px) {
  .sum { right: 8px; top: 8px; max-width: 150px; padding: 6px 8px; font-size: 11px; }
  .sum-day { font-size: 17px; }
  .label text { font-size: 10px; }
  .label .unit { font-size: 8.5px; }
}
</style>
