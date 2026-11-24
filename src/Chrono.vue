<template>
  <!-- 編年表分頁：像試算表——上面一列（縣市）、左邊三欄（年份、總統、大事）凍結，其他照一般捲動；上面的工具列：顯示什麼、字級、縮放、操作模式 -->
  <div class="pane">
    <!-- 工具列（Bootstrap 元件、Material Symbols 圖示）：顯示什麼、字級、縮放、滾輪縮放模式／拖曳模式、回到預設 -->
    <div class="toolbar">
      <div class="ctl" role="toolbar" aria-label="工具列">
        <ModeTabs />
        <div class="tb-grp" role="group" aria-label="格子上顯示什麼">
          <button v-for="[k, l] in SHOW" :key="k" type="button" class="btn btn-sm btn-tb" :class="{ active: show[k] }" :aria-pressed="show[k]" :title="`顯示${l}`" @click="show[k] = !show[k]">{{ l }}</button>
        </div>
        <div class="vr"></div>
        <div class="tb-grp" role="group" aria-label="字級">
          <button type="button" class="btn btn-sm btn-tb" title="字小一點" :disabled="fs <= FONTS[0]" @click="fontStep(-1)"><span class="material-symbols-outlined">text_decrease</span></button>
          <button type="button" class="btn btn-sm btn-tb" title="字大一點" :disabled="fs >= FONTS.at(-1)" @click="fontStep(1)"><span class="material-symbols-outlined">text_increase</span></button>
        </div>
        <div class="vr"></div>
        <div class="tb-grp" role="group" aria-label="縮放">
          <button type="button" class="btn btn-sm btn-tb" title="縮小（-）" :disabled="zT <= MIN_Z" @click="zoomStep(-1)"><span class="material-symbols-outlined">zoom_out</span></button>
          <input type="range" class="form-range" :min="-2" :max="2" step="0.01" :value="Math.log2(zT)" aria-label="縮放" @input="zoomTo(2 ** +$event.target.value)" />
          <button type="button" class="btn btn-sm btn-tb" title="放大（+）" :disabled="zT >= MAX_Z" @click="zoomStep(1)"><span class="material-symbols-outlined">zoom_in</span></button>
          <span class="pct">{{ Math.round(z * 100) }}%</span>
        </div>
        <div class="vr"></div>
        <div class="tb-grp" role="group" aria-label="操作模式">
          <button type="button" class="btn btn-sm btn-tb" :class="{ active: wheel }" :aria-pressed="wheel" title="滾輪＝縮放（以游標為中心）；跟拖曳模式二選一，再按一次＝關掉（滾輪照一般捲動）" @click="setOp(wheel ? null : 'wheel')">滾輪縮放模式</button>
          <button type="button" class="btn btn-sm btn-tb" :class="{ active: nav }" :aria-pressed="nav" title="按住拖曳＝移動（表的四周可以拖出去）；跟滾輪縮放模式二選一，再按一次＝關掉" @click="setOp(nav ? null : 'nav')">拖曳模式</button>
        </div>
        <div class="vr"></div>
        <button type="button" class="btn btn-sm btn-tb" title="縮放 100%、字級、顯示項目、滾輪縮放模式、拖曳模式都回到預設（0）" :disabled="isDefault" @click="reset"><span class="material-symbols-outlined">restart_alt</span><span class="lbl">回到預設</span></button>
      </div>
    </div>

    <div ref="scroller" class="scroller" :class="{ dragging, nav }" tabindex="0" :style="{ fontSize: `${11 * f}px` }"
      @wheel="onWheel" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @mousemove="onHover" @mouseleave="tip?.sheet || (tip = null)" @scroll="tip = null">
      <div class="sheet" :style="{ gridTemplateColumns: `${padX}px ${axisW}px ${cw}px ${padX}px`, gridTemplateRows: `${padY}px ${headH}px ${ch}px ${padY}px` }">
        <!-- 左上角：凍結欄的欄名 -->
        <div class="corner">
          <div class="head" :style="{ left: 0, width: `${YEAR_W * f}px` }"><b>年</b></div>
          <div class="head" :style="{ left: `${YEAR_W * f}px`, width: `${PRES_W * f}px` }"><b>總統</b></div>
          <div v-if="EV_W" class="head" :style="{ left: `${(YEAR_W + PRES_W) * f}px`, width: `${EV_W * f}px` }"><b>大事</b></div>
        </div>
        <!-- 縣市名（凍結在上面）；合併的縣市下面再分縣、市；點了開維基 -->
        <div class="heads">
          <div v-for="c in cols" :key="c.name" class="head" :style="{ left: `${c.col * px}px`, width: `${c.units.length * px}px` }">
            <b :data-url="wiki(c.name)" :title="`維基百科：${c.name}`">{{ c.name }}</b>
            <span v-if="c.units.length > 1" class="subs"><span v-for="u in c.units" :key="u" :data-url="wiki(u)" :title="`維基百科：${u}`">{{ u }}</span></span>
          </div>
        </div>
        <!-- 左邊凍結：年份、總統（顏色＝中央執政黨）、大事 -->
        <div class="axis">
          <span v-for="y in ticks" :key="y" class="year" :title="y" :style="{ top: `${(y - Y0) * py}px`, width: `${YEAR_W * f}px` }">’{{ String(y).slice(2) }}</span>
          <div v-for="(p, i) in pres" :key="p.name" class="blk" :aria-label="p.tip" :data-p="i" :data-url="wiki(p.name)" :style="{ left: `${YEAR_W * f + 2}px`, width: `${PRES_W * f - 4}px`, top: `${p.a * py}px`, height: `${p.h}px`, ...bg(COLOR[p.party], p.name) }">
            <i v-for="c in p.cuts" :key="c" class="cut" :style="{ top: `${c * py}px` }"></i>
            <span v-if="p.hf >= 11 && (show.name || show.time)" :style="{ top: `${headH}px` }"><template v-if="show.name"><b>{{ p.name }}</b><em v-if="!p.end" class="now">現任</em></template><template v-if="show.time"><small v-if="p.hf >= (show.name ? 27 : 14)">{{ ymd(p.start) }}</small><small v-if="p.hf >= (show.name ? 36 : 23)">{{ ymd(p.end ?? H.asOf, H.asOf) }}</small></template></span>
          </div>
          <!-- 大事：日期＋名稱；擠在一起的往下排開，引線指回實際的時間 -->
          <svg v-if="EV_W" class="leads" :style="{ left: `${(YEAR_W + PRES_W) * f}px` }" width="12" height="1"><path v-for="e in events" :key="e.date + e.label" :d="`M1 ${e.y * py}L${9 * f} ${e.ly}`" /></svg>
          <div v-for="e in (EV_W ? events : [])" :key="e.date + e.label" class="ev" :class="e.kind" :title="e.tip" :style="{ left: `${(YEAR_W + PRES_W) * f}px`, top: `${e.ly}px` }"><small>{{ ymd(e.date) }}</small>{{ e.label }}</div>
        </div>
        <!-- 格子：一格一人，點了開維基 -->
        <div class="body" :style="{ backgroundSize: `${px}px 100%` }">
          <div v-for="y in ticks" :key="y" class="line" :style="{ top: `${(y - Y0) * py}px` }"></div>
          <div v-for="(b, i) in shown" :key="b.id" class="blk" :class="{ acting: b.t.acting, noted: b.t.note }" :aria-label="b.tip" :data-i="i" :data-url="b.url"
            :style="{ left: `${b.col * px}px`, width: `${b.span * px - 2}px`, top: `${b.a * py}px`, height: `${b.h}px`, ...bg(b.color, b.t.wiki, b.t.note) }">
            <i v-for="c in b.cuts" :key="c" class="cut" :style="{ top: `${c * py}px` }"></i>
            <span v-if="b.hf >= 11 && (show.name || show.time)" :style="{ top: `${headH}px`, left: `${axisW}px` }"><template v-if="show.name"><b>{{ b.t.name }}</b><em v-for="g in b.tags" :key="g" :class="{ now: g === '現任' }">{{ g }}</em></template><template v-if="show.time"><small v-if="b.hf >= (show.name ? 27 : 14)">{{ ymd(b.t.start) }}</small><small v-if="b.hf >= (show.name ? 36 : 23)">{{ ymd(b.t.end, H.asOf) }}</small></template><small v-if="show.color && b.hf >= 58 && px / f >= 90">{{ b.t.partyName }}</small></span>
          </div>
        </div>
      </div>
    </div>

    <TipCard :tip="tip" @close="tip = null" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import TipCard from './TipCard.vue'
import ModeTabs from './ModeTabs.vue'
import { plain } from './theme.js'
import { COLOR, MERGED, MERGE_DAY, colorOf, yr, ymd } from './parties.js'
import { EVS, H, PRES, RUNS, Y0, Y1, cutsOf, loadPhotos, photos, presTip, termTags, termTip, termUrl, tipPos, wiki } from './shared.js'

const props = defineProps({ active: { type: Boolean, default: true } }) // 這個分頁是不是正在看（藏起來時不收鍵盤）
const YEAR_W = 28, HEAD = 40 // 年份欄的寬、上面縣市名那一列的高（100%、預設字級時的 px）
const MIN_COL = 46, MIN_YEAR = 10 // 100% 時一欄最少幾 px（放得下三個字的名字＋兩邊的留白）、一年最少幾 px：畫面小就用捲的，不硬擠到看不到
const NARROW = 720 // 畫面比這個窄＝手機版面
const MIN_Z = 0.25, MAX_Z = 4 // 縮放範圍（100%＝整張表剛好放進畫面）
const STOPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4] // ＋／－ 按鈕一次跳一格
const FONTS = [0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2] // 字級（A－／A＋ 一次跳一格）
const SHOW = [['name', '市長名'], ['color', '政黨色'], ['time', '時間'], ['photo', '照片']] // 格子上顯示什麼（這一組按鈕只有字，不放圖示）

// 縣市由北到南、再東部、離島；合併的三個縣市佔兩欄（市、縣）
const ORDER = ['臺北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣']
const cols = (() => {
  let col = 0
  return ORDER.map((name) => {
    const units = MERGED.includes(name) ? [name, name.slice(0, 2) + '縣'] : [name]
    const c = { name, units, col }
    col += units.length
    return c
  })
})()
const N = cols.at(-1).col + cols.at(-1).units.length

// 格子：每個縣市的每一段任期（shared.js 的 RUNS）；位置先算成「年」（a、b），畫的時候再乘上每年幾 px
const blocks = cols.flatMap((c) => RUNS[c.name].map((t) => {
  const after = c.units.length > 1 && t.unit === c.name && t.start >= MERGE_DAY
  const a = Math.max(Y0, yr(t.start)) - Y0, b = Math.min(Y1, yr(t.end)) - Y0
  return {
    id: t.unit + t.start, t, a, b, color: colorOf(t), tags: termTags(t), cuts: cutsOf(t.cuts, a, b), url: termUrl(t),
    col: c.col + (after || c.units.length === 1 ? 0 : c.units.indexOf(t.unit)), span: after ? c.units.length : 1,
    tip: `${t.unit}　${t.start}–${t.end === H.asOf ? '現任' : t.end}　${termTags(t).map((g) => `${g} `).join('')}${t.name}（${t.partyName}）`,
  }
}).filter((b) => b.b > b.a))

// ── 顯示什麼、字級、縮放
// z＝縮放倍數（1＝100%＝整張表剛好放進畫面）。格子照 z 放大；字和凍結的欄列照 f＝字級 × √z（放大時字變大，也多出日期等內容）
const scroller = ref(null)
const size = reactive({ w: 1200, h: 800 })
// 左邊凍結的三欄：年份、總統（中央執政黨）、大事。手機版面：總統欄窄一點、大事收起來
const compact = computed(() => size.w < NARROW)
const PRES_W = computed(() => (compact.value ? 48 : 60)), EV_W = computed(() => (compact.value ? 0 : 138))
const AXIS = computed(() => YEAR_W + PRES_W.value + EV_W.value)
const show = reactive({ name: true, color: true, time: true, photo: false }) // 照片（格子的底）預設關
const fs = ref(1) // 字級
const wheel = ref(false) // 滾輪縮放模式（預設關：滾輪照一般捲動，像試算表）
const nav = ref(false) // 拖曳模式（預設關）：按住拖曳＝移動，表的四周留空白可以拖出去
const z = ref(1), zT = ref(1) // 現在的倍數、要去的倍數
const f = computed(() => fs.value * Math.sqrt(z.value))
const axisW = computed(() => AXIS.value * f.value), headH = computed(() => HEAD * f.value)
// 100% 時格子區的寬、高（畫面扣掉凍結的欄、列）。寬：畫面夠寬就剛好放進畫面（沒有橫的捲軸）；不夠寬時每一欄維持最小寬度（字放大，最小寬度跟著放大），改用橫的捲。高：太矮就用最小列高，上下捲
const bw0 = computed(() => Math.max(N * MIN_COL * fs.value, size.w - AXIS.value * fs.value - 1)), bh0 = computed(() => Math.max((Y1 - Y0) * MIN_YEAR, size.h - HEAD * fs.value - 2))
const cw = computed(() => bw0.value * z.value), ch = computed(() => bh0.value * z.value)
// 開了拖曳：表的四周留空白（畫面的六成），縮小、捲到邊上時黑色的地方也能繼續拖
const padX = computed(() => (nav.value ? Math.round(size.w * 0.6) : 0)), padY = computed(() => (nav.value ? Math.round(size.h * 0.6) : 0))
const px = computed(() => cw.value / N) // 一欄幾 px
const py = computed(() => ch.value / (Y1 - Y0)) // 一年幾 px

const ticks = computed(() => {
  const k = py.value / f.value, step = k >= 20 ? 1 : k >= 8 ? 2 : 5
  const out = []
  for (let v = Math.ceil(Y0 / step) * step; v <= Y1; v += step) out.push(v)
  return out
})
// 格子的高（hf＝換算回預設字級的高：放不放得下名字、日期）。名字四邊一律留 p-1（0.25rem）。名字 ≥ 11；加就任日 ≥ 27；再加卸任日 ≥ 36
const sized = (b) => { const h = Math.max(1, (b.b - b.a) * py.value - 1); return { ...b, h, hf: h / f.value } }
const shown = computed(() => blocks.map(sized))
const pres = computed(() => PRES.map(sized))
// 大事：照時間排，跟上一個不到一行就往下推
const events = computed(() => {
  let prev = -99
  return EVS.map((e) => ({ ...e, ly: (prev = Math.max(e.y * py.value, prev + 13 * f.value)) }))
})

// 縮放時畫面上 (ax, ay)（捲動區裡的座標）那一點不動：記下它在表上的位置（100% 的座標），每一格照它算捲動位置
const clampZ = (v) => Math.min(MAX_Z, Math.max(MIN_Z, v))
let ax = 0, ay = 0, ux = 0, uy = 0, raf = 0, last = 0
function apply(zn) {
  z.value = zn
  const fn = fs.value * Math.sqrt(zn), bw = bw0.value, bh = bh0.value, el = scroller.value
  nextTick(() => {
    el.scrollLeft = ux * bw * zn + AXIS.value * fn + padX.value - ax
    el.scrollTop = uy * bh * zn + HEAD * fn + padY.value - ay
  })
}
function tick(now) {
  const dt = Math.min(50, now - last || 16)
  last = now
  if (Math.abs(Math.log(zT.value / z.value)) > 0.002) {
    apply(z.value * Math.pow(zT.value / z.value, 1 - Math.pow(0.8, dt / 16)))
    raf = requestAnimationFrame(tick)
  } else {
    if (z.value !== zT.value) apply(zT.value)
    raf = 0
  }
}
// 記下 (x, y) 在表上的位置（0–1：佔整張表的幾分之幾）
function anchor(x = (size.w + axisW.value) / 2, y = (size.h + headH.value) / 2) {
  const el = scroller.value
  ax = x, ay = y
  ux = (el.scrollLeft + x - axisW.value - padX.value) / cw.value
  uy = (el.scrollTop + y - headH.value - padY.value) / ch.value
}
function zoomTo(v, x, y) {
  anchor(x, y)
  zT.value = clampZ(v)
  if (!raf) last = performance.now(), raf = requestAnimationFrame(tick)
}
const zoomStep = (dir) => zoomTo((dir > 0 ? STOPS.find((s) => s > zT.value * 1.01) : STOPS.findLast((s) => s < zT.value / 1.01)) ?? zT.value)
// 字級：畫面中間那一點不動
function setFont(v) {
  anchor()
  fs.value = v
  apply(z.value)
}
const fontStep = (dir) => setFont((dir > 0 ? FONTS.find((s) => s > fs.value + 0.001) : FONTS.findLast((s) => s < fs.value - 0.001)) ?? fs.value)
// 操作模式：滾輪縮放、拖曳二選一（或都不開）。開關拖曳時四周的空白跟著有、沒有，畫面左上角那一點留在原地
function setOp(op) {
  anchor(axisW.value, headH.value)
  wheel.value = op === 'wheel'
  nav.value = op === 'nav'
  if (!raf) apply(z.value)
}
// 回到預設：100%、預設字級、三樣都顯示、滾輪縮放模式、拖曳模式關掉、捲回左上角
const isDefault = computed(() => zT.value === 1 && fs.value === 1 && show.name && show.color && show.time && !show.photo && !wheel.value && !nav.value)
function reset() {
  show.name = show.color = show.time = true
  show.photo = false
  fs.value = 1
  wheel.value = nav.value = false
  zoomTo(1)
  ax = AXIS.value, ay = HEAD, ux = uy = 0 // 表的左上角對齊凍結的欄、列
}

// 開了滾輪縮放：滾輪＝縮放（以游標為中心），Shift＋滾輪、橫向滑＝照一般左右捲動；沒開：滾輪照一般捲動
// 觸控板捏合、Ctrl＋滾輪不管開關都是縮放（不然瀏覽器會把整頁放大）
function onWheel(e) {
  if (!e.ctrlKey && (!wheel.value || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) return
  e.preventDefault()
  const r = scroller.value.getBoundingClientRect(), d = e.deltaY * (e.deltaMode === 1 ? 16 : 1)
  zoomTo(zT.value * Math.exp(-d * (e.ctrlKey ? 0.012 : 0.0022)), e.clientX - r.left, e.clientY - r.top) // 捏合的數值小，倍率大一點
}

// ── 資訊卡
// 格子的底：黨色（不顯示政黨色＝灰）；非民選加斜線；開了「照片」而且有照片：照片鋪滿，上面蓋一層黨色（上濃下淡，字在上面看得清楚）
const HATCH = 'repeating-linear-gradient(135deg, rgba(14, 14, 15, 0.4) 0 2px, transparent 2px 6px)'
function bg(color, title, note) {
  const c = show.color ? color : plain(), photo = show.photo && photos[title]
  const img = [note && HATCH, photo && `linear-gradient(${c}f2 0, ${c}b3 2.5em, ${c}33 6em)`, photo && `url("${photo}")`].filter(Boolean)
  return { backgroundColor: c, ...(img.length ? { backgroundImage: img.join(', '), backgroundSize: img.map((_, i) => (photo && i === img.length - 1 ? 'cover' : 'auto')).join(', '), backgroundPosition: 'center top' } : {}) }
}
const tip = ref(null)
function onHover(e) {
  if (tip.value?.sheet) return // 觸控開的卡：留著，不跟滑鼠事件走
  const el = dragging.value ? null : e.target.closest?.('[data-i], [data-p]')
  if (!el) return (tip.value = null)
  tip.value = el.dataset.p != null ? presTip(PRES[el.dataset.p], tipPos(e)) : termTip(blocks[el.dataset.i].t, tipPos(e))
}

// 開了拖曳：滑鼠按住拖曳＝移動；沒拖動就是點擊（格子開這位首長的維基條目，縣市名開縣市的條目）
const dragging = ref(false)
let down = null
function onDown(e) {
  if (e.button !== 0) return
  down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, moved: 0, mouse: e.pointerType === 'mouse' }
  if (down.mouse) scroller.value.setPointerCapture(e.pointerId)
}
function onMove(e) {
  if (!down || e.pointerId !== down.id) return
  const dx = e.clientX - down.x, dy = e.clientY - down.y
  down.x = e.clientX, down.y = e.clientY
  down.moved += Math.abs(dx) + Math.abs(dy)
  if (!down.mouse || !nav.value) return // 觸控：瀏覽器自己捲
  if (down.moved >= 5) dragging.value = true
  scroller.value.scrollLeft -= dx
  scroller.value.scrollTop -= dy
}
function onUp(e) {
  if (!down || e.pointerId !== down.id) return
  if (e.type === 'pointerup' && down.moved < 5 && e.timeStamp - down.t < 500) {
    const el = document.elementFromPoint(e.clientX, e.clientY), blk = el?.closest('[data-i], [data-p]')
    // 觸控點格子：先出資訊卡（卡上有開維基的按鈕）；點別的地方把卡收掉。滑鼠、縣市名：直接開維基
    if (!down.mouse && blk) tip.value = { ...(blk.dataset.p != null ? presTip(PRES[blk.dataset.p], {}) : termTip(blocks[blk.dataset.i].t, {})), sheet: true }
    else if (!down.mouse && tip.value) tip.value = null
    else { const url = el?.closest('[data-url]')?.dataset.url; if (url) window.open(url, '_blank', 'noopener') }
  }
  down = null
  dragging.value = false
}
function onKey(e) {
  if (!props.active || e.altKey || e.target.tagName === 'INPUT') return
  if (e.key === '+' || e.key === '=') zoomStep(1)
  else if (e.key === '-' || e.key === '_') zoomStep(-1)
  else if (e.key === '0') reset()
  else return
  e.preventDefault() // 也擋掉瀏覽器自己的 ⌘＋／⌘－
}

// 觸控兩指捏合＝縮放（以兩指中間為中心）；一指照瀏覽器自己捲
let pinch = null
function onTouch(e) {
  if (e.touches.length !== 2) return (pinch = null)
  e.preventDefault()
  const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, r = scroller.value.getBoundingClientRect()
  pinch ??= { d, z: zT.value }
  tip.value = null
  zoomTo(pinch.z * (d / pinch.d), (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top)
}

let ro
onMounted(() => {
  for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) scroller.value.addEventListener(t, onTouch, { passive: false })
  let first = true
  ro = new ResizeObserver(() => {
    const r = scroller.value.getBoundingClientRect()
    if (!r.width) return // 切到地圖分頁、這一頁藏起來的時候
    if (first) ax = AXIS.value, ay = HEAD, ux = uy = 0, first = false
    else anchor(axisW.value, headH.value)
    size.w = scroller.value.clientWidth, size.h = r.height // 寬不含直的捲軸（位置固定留著，見 scrollbar-gutter）
    if (!raf) apply(z.value)
  })
  ro.observe(scroller.value)
  window.addEventListener('keydown', onKey)
  loadPhotos()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.pane { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.scroller { flex: 1; min-height: 0; overflow: auto; scrollbar-gutter: stable; outline: 0; cursor: default; user-select: none; -webkit-user-select: none; overscroll-behavior: contain; }
.scroller.nav { cursor: grab; }
.scroller.dragging, .scroller.dragging * { cursor: grabbing !important; }
/* 捲軸：細、圓角、深色，滑鼠移上去才亮一點（Firefox 沒有 ::-webkit-scrollbar，用標準寫法） */
.scroller::-webkit-scrollbar { width: 12px; height: 12px; }
.scroller::-webkit-scrollbar-track, .scroller::-webkit-scrollbar-corner { background: transparent; }
.scroller::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 6px; background: rgba(var(--fg), 0.22); background-clip: content-box; }
.scroller::-webkit-scrollbar-thumb:hover { background-color: rgba(var(--fg), 0.4); }
.scroller::-webkit-scrollbar-thumb:active { background-color: var(--accent); }
@supports (-moz-appearance: none) { .scroller { scrollbar-width: thin; scrollbar-color: rgba(var(--fg), 0.28) transparent; } }
.sheet { display: grid; width: max-content; }
/* 凍結的列、欄：跟著表走，捲出畫面時才貼在上面、左邊（表的四周是可以拖的空白） */
.corner, .heads, .axis { position: sticky; background: var(--bg); }
.corner { grid-area: 2 / 2; top: 0; left: 0; z-index: 4; }
.heads { grid-area: 2 / 3; top: 0; z-index: 3; }
.axis { grid-area: 3 / 2; left: 0; z-index: 2; }
.corner, .heads { background: var(--chrome); border-bottom: 1px solid var(--grid-strong); }
.corner, .axis { border-right: 1px solid var(--grid-strong); }
/* 格子區：直線＝欄的格線，橫線＝年份 */
.body { grid-area: 3 / 3; position: relative; background-image: linear-gradient(to right, var(--grid) 1px, transparent 1px); background-position: -1px 0; }
.line { position: absolute; left: 0; right: 0; border-top: 1px solid var(--grid); }
</style>
