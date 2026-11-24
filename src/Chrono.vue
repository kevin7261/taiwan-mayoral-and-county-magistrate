<template>
  <!-- 22 縣市歷任首長編年總表：像試算表——上面一列（縣市）、左邊三欄（年份、總統、大事）凍結，其他照一般捲動；下面的列放圖例、顯示什麼、字級和縮放 -->
  <div class="page">
    <header class="bar">
      <h1>臺灣縣市長編年表</h1>
      <span class="right">
        <a href="https://zh.wikipedia.org/wiki/臺北市市長" target="_blank" rel="noopener" :title="`中文維基百科各縣市「XX縣縣長」「XX市市長」條目，到 ${H.asOf}`">資料：中文維基百科（到 {{ H.asOf }}）</a>
      </span>
    </header>

    <div ref="scroller" class="scroller" :class="{ dragging }" tabindex="0" :style="{ fontSize: `${11 * f}px` }"
      @wheel="onWheel" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
      <div class="sheet" :style="{ gridTemplateColumns: `${padX}px ${axisW}px ${cw}px ${padX}px`, gridTemplateRows: `${padY}px ${headH}px ${ch}px ${padY}px` }">
        <!-- 左上角：凍結欄的欄名 -->
        <div class="corner">
          <div class="head" :style="{ left: 0, width: `${YEAR_W * f}px` }"><b>年</b></div>
          <div class="head" :style="{ left: `${YEAR_W * f}px`, width: `${PRES_W * f}px` }"><b>總統</b></div>
          <div class="head" :style="{ left: `${(YEAR_W + PRES_W) * f}px`, width: `${EV_W * f}px` }"><b>大事</b></div>
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
          <span v-for="y in ticks" :key="y" class="year" :style="{ top: `${(y - Y0) * py}px`, width: `${YEAR_W * f}px` }">{{ y }}</span>
          <div v-for="p in pres" :key="p.name" class="blk" :title="p.tip" :data-url="wiki(p.name)" :style="{ left: `${YEAR_W * f + 2}px`, width: `${PRES_W * f - 4}px`, top: `${p.a * py}px`, height: `${p.h}px`, backgroundColor: show.color ? COLOR[p.party] : PLAIN }">
            <i v-for="c in p.cuts" :key="c" class="cut" :style="{ top: `${c * py}px` }"></i>
            <span v-if="p.hf >= 11 && (show.name || show.time)" :style="{ top: `${headH}px` }"><template v-if="show.name">{{ p.name }}</template><template v-if="show.time && p.hf >= (show.name ? 36 : 22)"><small>{{ ymd(p.start) }}</small><small>{{ ymd(p.end ?? H.asOf, H.asOf) }}</small></template></span>
          </div>
          <!-- 大事：日期＋名稱；擠在一起的往下排開，引線指回實際的時間 -->
          <svg class="leads" :style="{ left: `${(YEAR_W + PRES_W) * f}px` }" width="12" height="1"><path v-for="e in events" :key="e.date + e.label" :d="`M1 ${e.y * py}L${9 * f} ${e.ly}`" /></svg>
          <div v-for="e in events" :key="e.date + e.label" class="ev" :class="e.kind" :title="e.tip" :style="{ left: `${(YEAR_W + PRES_W) * f}px`, top: `${e.ly}px` }"><small>{{ ymd(e.date) }}</small>{{ e.label }}</div>
        </div>
        <!-- 格子：一格一人，點了開維基 -->
        <div class="body" :style="{ backgroundSize: `${px}px 100%` }">
          <div v-for="y in ticks" :key="y" class="line" :style="{ top: `${(y - Y0) * py}px` }"></div>
          <div v-for="b in shown" :key="b.id" class="blk" :class="{ acting: b.t.acting, noted: b.t.note }" :title="b.tip" :data-url="b.url"
            :style="{ left: `${b.col * px}px`, width: `${b.span * px - 2}px`, top: `${b.a * py}px`, height: `${b.h}px`, backgroundColor: show.color ? b.color : PLAIN }">
            <i v-for="c in b.cuts" :key="c" class="cut" :style="{ top: `${c * py}px` }"></i>
            <span v-if="b.hf >= 11 && (show.name || show.time)" :style="{ top: `${headH}px`, left: `${axisW}px` }"><template v-if="show.name">{{ b.label }}<em v-if="b.t.note && b.hf >= 24">{{ b.t.note }}</em></template><template v-if="show.time && b.hf >= (show.name ? 36 : 22)"><small>{{ ymd(b.t.start) }}</small><small>{{ ymd(b.t.end, H.asOf) }}</small></template><small v-if="show.color && b.hf >= 52 && px / f >= 90">{{ b.t.partyName }}</small></span>
          </div>
        </div>
      </div>
    </div>

    <footer class="foot">
      <span v-for="p in H.parties" :key="p.key" class="lg" :title="`${count[p.key] ?? 0} 人次（民選，同一人連任算一次）`"><i :style="{ background: COLOR[p.key] }"></i>{{ p.label }}</span>
      <span class="lg"><i :style="{ background: UNKNOWN }"></i>黨籍不詳</span>
      <span class="lg"><i class="acting" :style="{ background: COLOR.kmt }"></i>（代理）</span>
      <span class="lg"><i class="noted" :style="{ background: COLOR.kmt }"></i>非民選</span>
      <span class="ctl">
        <span class="grp">
          <span class="lab">顯示</span>
          <button v-for="[k, l] in SHOW" :key="k" type="button" class="chip" :class="{ on: show[k] }" :aria-pressed="show[k]" @click="show[k] = !show[k]">{{ l }}</button>
        </span>
        <span class="grp">
          <span class="lab">字</span>
          <button type="button" title="字小一點" :disabled="fs <= FONTS[0]" @click="fontStep(-1)">A－</button>
          <button type="button" title="字大一點" :disabled="fs >= FONTS.at(-1)" @click="fontStep(1)">A＋</button>
        </span>
        <span class="grp">
          <button type="button" title="縮小（-）" :disabled="zT <= MIN_Z" @click="zoomStep(-1)">－</button>
          <input type="range" :min="-2" :max="2" step="0.01" :value="Math.log2(zT)" aria-label="縮放" @input="zoomTo(2 ** +$event.target.value)" />
          <button type="button" title="放大（+）" :disabled="zT >= MAX_Z" @click="zoomStep(1)">＋</button>
          <span class="pct">{{ Math.round(z * 100) }}%</span>
        </span>
        <button type="button" class="chip" title="縮放 100%、字級和顯示項目都回到預設（0）" :disabled="isDefault" @click="reset">回到預設</button>
      </span>
    </footer>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import H from './data/mayor-history.json'
import { EVENTS, PARTY_SHORT, PRESIDENTS } from './central.js'
import { COLOR, MERGED, MERGE_DAY, UNKNOWN, colorOf, nameOf, sameRun, yr, ymd } from './parties.js'

const ACTING_DIM = 0.45 // 代理：黨色上面蓋一層 45% 的黑
const PLAIN = '#4a4c4b' // 不顯示政黨色時格子的顏色
const YEAR_W = 34, PRES_W = 60, EV_W = 138 // 左邊凍結的三欄：年份、總統（中央執政黨）、大事（100%、預設字級時的 px）
const AXIS = YEAR_W + PRES_W + EV_W, HEAD = 40 // 左邊整塊的寬、上面縣市名那一列的高（同上）
const MIN_Z = 0.25, MAX_Z = 4 // 縮放範圍（100%＝整張表剛好放進畫面）
const STOPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4] // ＋／－ 按鈕一次跳一格
const FONTS = [0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2] // 字級（A－／A＋ 一次跳一格）
const SHOW = [['name', '市長名'], ['color', '政黨色'], ['time', '時間']] // 格子上顯示什麼

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

const wiki = (title) => `https://zh.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`
// 臺北縣→新北市、桃園縣→桃園市是升格，同一欄
// 同一人在同一欄連任合成一格；縣市合併那天起算新的一格（合併後橫跨兩欄）
function lines(terms) {
  const out = []
  for (const t of terms) {
    const last = out.findLast((x) => x.unit === t.unit)
    if (last && sameRun(last, t)) last.end = t.end, last.cuts.push(t.start)
    else out.push({ ...t, cuts: [] })
  }
  return out
}
// 各黨幾人次（同一人連任算一次；代理、非民選不算）
const count = (() => {
  const out = {}
  for (const c of Object.values(H.counties)) for (const t of lines(c.terms.filter((t) => !t.acting && !t.note))) out[t.party] = (out[t.party] ?? 0) + 1
  return out
})()

// 時間範圍：最早的第一任民選 → 資料截止日；格子的位置先算成「年」（a、b），畫的時候再乘上每年幾 px
const Y0 = yr(Object.values(H.counties).reduce((m, c) => (c.from < m ? c.from : m), '9999')), Y1 = yr(H.asOf)
// 連任的交界（下一任的就職日）：格子裡畫虛線；位置＝離格子頂端幾年
const cutsOf = (dates, a, b) => dates.map((d) => yr(d) - Y0 - a).filter((v) => v > 0 && v < b - a)
const blocks = cols.flatMap((c) => lines(H.counties[c.name].terms.filter((t) => t.start < H.asOf)).map((t) => {
  const after = c.units.length > 1 && t.unit === c.name && t.start >= MERGE_DAY
  const a = Math.max(Y0, yr(t.start)) - Y0, b = Math.min(Y1, yr(t.end)) - Y0
  return {
    id: t.unit + t.start, t, a, b, color: colorOf(t), label: nameOf(t), cuts: cutsOf(t.cuts, a, b),
    col: c.col + (after || c.units.length === 1 ? 0 : c.units.indexOf(t.unit)), span: after ? c.units.length : 1,
    url: t.wiki ? wiki(t.wiki) : `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(t.name)}`, // 表格裡沒連到條目的：用名字搜尋
    tip: `${t.unit}　${t.start}–${t.end === H.asOf ? '現任' : t.end}　${t.note ? `${t.note} ` : ''}${t.acting ? '代理 ' : ''}${t.name}（${t.partyName}）`,
  }
}).filter((b) => b.b > b.a))

// ── 顯示什麼、字級、縮放
// z＝縮放倍數（1＝100%＝整張表剛好放進畫面）。格子照 z 放大；字和凍結的欄列照 f＝字級 × √z（放大時字變大，也多出日期等內容）
const scroller = ref(null)
const size = reactive({ w: 1200, h: 800 })
const show = reactive({ name: true, color: true, time: true })
const fs = ref(1) // 字級
const z = ref(1), zT = ref(1) // 現在的倍數、要去的倍數
const f = computed(() => fs.value * Math.sqrt(z.value))
const axisW = computed(() => AXIS * f.value), headH = computed(() => HEAD * f.value)
// 100% 時格子區的寬、高（扣掉凍結的欄、列）
const bw0 = computed(() => Math.max(100, size.w - AXIS * fs.value - 2)), bh0 = computed(() => Math.max(100, size.h - HEAD * fs.value - 2))
const cw = computed(() => bw0.value * z.value), ch = computed(() => bh0.value * z.value)
// 表的四周留空白（畫面的六成）：縮小、捲到邊上時黑色的地方也能繼續拖
const padX = computed(() => Math.round(size.w * 0.6)), padY = computed(() => Math.round(size.h * 0.6))
const px = computed(() => cw.value / N) // 一欄幾 px
const py = computed(() => ch.value / (Y1 - Y0)) // 一年幾 px

const ticks = computed(() => {
  const k = py.value / f.value, step = k >= 20 ? 1 : k >= 8 ? 2 : 5
  const out = []
  for (let v = Math.ceil(Y0 / step) * step; v <= Y1; v += step) out.push(v)
  return out
})
// 格子的高（hf＝換算回預設字級的高：放不放得下名字、日期）
const sized = (b) => { const h = Math.max(1, (b.b - b.a) * py.value - 1); return { ...b, h, hf: h / f.value } }
const shown = computed(() => blocks.map(sized))
const PRES = PRESIDENTS.map((p) => {
  const a = Math.max(Y0, yr(p.start)) - Y0, b = Math.min(Y1, yr(p.end ?? H.asOf)) - Y0
  return { ...p, a, b, cuts: cutsOf(p.cuts ?? [], a, b), tip: `總統 ${p.name}（${PARTY_SHORT[p.party]}）${p.start}–${p.end ?? '現任'}${p.note ? `　${p.note}` : ''}` }
}).filter((p) => p.b > p.a)
const pres = computed(() => PRES.map(sized))
// 大事：照時間排，跟上一個不到一行就往下推
const EVS = EVENTS.map((e) => ({ ...e, y: yr(e.date) - Y0, tip: `${e.date}　${e.label}${e.note ? `：${e.note}` : ''}` })).filter((e) => e.y > 0 && e.y < Y1 - Y0).sort((a, b) => a.y - b.y)
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
    el.scrollLeft = ux * bw * zn + AXIS * fn + padX.value - ax
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
// 回到預設：100%、預設字級、三樣都顯示、捲回左上角
const isDefault = computed(() => zT.value === 1 && fs.value === 1 && show.name && show.color && show.time)
function reset() {
  show.name = show.color = show.time = true
  fs.value = 1
  zoomTo(1)
  ax = AXIS, ay = HEAD, ux = uy = 0 // 表的左上角對齊凍結的欄、列
}

// 滾輪、觸控板捏合＝縮放（以游標為中心）；Shift＋滾輪、橫向滑＝照一般左右捲動
function onWheel(e) {
  if (!e.ctrlKey && (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) return
  e.preventDefault()
  const r = scroller.value.getBoundingClientRect(), d = e.deltaY * (e.deltaMode === 1 ? 16 : 1)
  zoomTo(zT.value * Math.exp(-d * (e.ctrlKey ? 0.012 : 0.0022)), e.clientX - r.left, e.clientY - r.top) // 捏合的數值小，倍率大一點
}

// 滑鼠按住拖曳＝移動；沒拖動就是點擊（格子開這位首長的維基條目，縣市名開縣市的條目）
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
  if (!down.mouse) return // 觸控：瀏覽器自己捲
  if (down.moved >= 5) dragging.value = true
  scroller.value.scrollLeft -= dx
  scroller.value.scrollTop -= dy
}
function onUp(e) {
  if (!down || e.pointerId !== down.id) return
  if (e.type === 'pointerup' && down.moved < 5 && e.timeStamp - down.t < 500) {
    const url = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-url]')?.dataset.url
    if (url) window.open(url, '_blank', 'noopener')
  }
  down = null
  dragging.value = false
}
function onKey(e) {
  if (e.altKey || e.target.tagName === 'INPUT') return
  if (e.key === '+' || e.key === '=') zoomStep(1)
  else if (e.key === '-' || e.key === '_') zoomStep(-1)
  else if (e.key === '0') reset()
  else return
  e.preventDefault() // 也擋掉瀏覽器自己的 ⌘＋／⌘－
}

let ro
onMounted(() => {
  let first = true
  ro = new ResizeObserver(() => {
    const r = scroller.value.getBoundingClientRect()
    if (first) ax = AXIS, ay = HEAD, ux = uy = 0, first = false
    else anchor(axisW.value, headH.value)
    size.w = r.width, size.h = r.height
    if (!raf) apply(z.value)
  })
  ro.observe(scroller.value)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; }
.bar, .foot { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 6px 12px; font-size: 12px; background: var(--chrome); }
.bar { border-bottom: 1px solid var(--line); }
.foot { border-top: 1px solid var(--line); padding: 4px 12px; }
.bar h1 { margin: 0 6px 0 0; font-size: 15px; }
.right { margin-left: auto; }
.right a { color: var(--dim); white-space: nowrap; }
.right a:hover { color: var(--accent); }
.lg { display: flex; align-items: center; gap: 5px; color: var(--muted); white-space: nowrap; }
.lg i { width: 14px; height: 10px; border-radius: 2px; }
.lg i.noted { background-image: repeating-linear-gradient(135deg, rgba(22, 22, 22, 0.4) 0 2px, transparent 2px 6px); }
.lg i.acting { box-shadow: inset 0 0 0 20px rgba(22, 22, 22, 0.45); }
/* 右邊的控制：顯示什麼、字級、縮放、回到預設 */
.ctl { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin-left: auto; }
.grp { display: flex; align-items: center; gap: 2px; }
.lab { margin-right: 4px; color: var(--dim); white-space: nowrap; }
.ctl button { min-width: 24px; height: 22px; padding: 0 6px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: var(--muted); font: inherit; white-space: nowrap; cursor: pointer; }
.ctl button:hover { background: rgba(255, 255, 255, 0.1); color: var(--text); }
.ctl button:disabled { opacity: 0.35; pointer-events: none; }
.ctl .chip { border-color: var(--line); }
.ctl .chip.on { border-color: var(--accent); background: var(--accent); color: var(--bg); }
.ctl input { width: 110px; accent-color: var(--accent); }
.pct { min-width: 40px; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }

.scroller { flex: 1; min-height: 0; overflow: auto; outline: 0; cursor: grab; user-select: none; -webkit-user-select: none; overscroll-behavior: contain; }
.scroller.dragging, .scroller.dragging * { cursor: grabbing !important; }
.sheet { display: grid; width: max-content; }
/* 凍結的列、欄：跟著表走，捲出畫面時才貼在上面、左邊（表的四周是可以拖的空白） */
.corner, .heads, .axis { position: sticky; background: var(--bg); }
.corner { grid-area: 2 / 2; top: 0; left: 0; z-index: 4; }
.heads { grid-area: 2 / 3; top: 0; z-index: 3; }
.axis { grid-area: 3 / 2; left: 0; z-index: 2; }
.corner, .heads { background: var(--chrome); border-bottom: 1px solid var(--grid-strong); }
.corner, .axis { border-right: 1px solid var(--grid-strong); }
.head { position: absolute; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; overflow: hidden; border-right: 1px solid var(--grid); text-align: center; font-size: 1.09em; line-height: 1.2; white-space: nowrap; }
.head b { font-weight: 600; }
.head .subs { display: flex; color: #999; font-size: 0.83em; }
.head .subs span { flex: 1; }
.heads .head b, .heads .subs span { cursor: pointer; }
.heads .head b:hover, .heads .subs span:hover { color: var(--accent); }
.year { position: absolute; left: 0; transform: translateY(-50%); color: #888; font-size: 0.91em; text-align: center; font-variant-numeric: tabular-nums; }
.leads { position: absolute; top: 0; overflow: visible; }
.leads path { fill: none; stroke: rgba(255, 221, 120, 0.7); stroke-width: 1; }
.ev { position: absolute; transform: translateY(-50%); padding-left: 1em; color: #ffdd78; line-height: 1.2; white-space: nowrap; }
.ev.up { color: #9fd6dc; } /* 縣市升格／改制 */
.ev small { margin-right: 0.5em; color: var(--muted); font-size: 0.86em; font-variant-numeric: tabular-nums; }
/* 格子區：直線＝欄的格線，橫線＝年份 */
.body { grid-area: 3 / 3; position: relative; background-image: linear-gradient(to right, var(--grid) 1px, transparent 1px); background-position: -1px 0; }
.line { position: absolute; left: 0; right: 0; border-top: 1px solid var(--grid); }
.blk { position: absolute; overflow: clip; border-radius: 2px; color: #fff; line-height: 1.2; cursor: pointer; }
.blk:hover { outline: 1px solid #fff; z-index: 1; }
/* 名字：格子比畫面長、捲過頭時留在看得到的地方（貼著凍結的列、欄） */
.blk span { position: sticky; display: block; width: fit-content; max-width: 100%; padding: 1px 3px; white-space: nowrap; text-shadow: 0 0 2px rgba(0, 0, 0, 0.5); }
.blk small { display: block; opacity: 0.8; font-size: 0.77em; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.blk .cut { position: absolute; left: 0; right: 0; border-top: 1px dashed rgba(255, 255, 255, 0.6); } /* 連任的交界 */
.blk.noted { background-image: repeating-linear-gradient(135deg, rgba(22, 22, 22, 0.4) 0 2px, transparent 2px 6px); } /* 非民選：黨色＋斜線 */
.blk em { display: block; width: fit-content; margin-top: 1px; padding: 0 2px; border-radius: 2px; background: rgba(22, 22, 22, 0.75); font-style: normal; font-size: 0.77em; }
.blk.acting::before { content: ''; position: absolute; inset: 0; background: rgba(22, 22, 22, v-bind(ACTING_DIM)); } /* 代理：黨色壓暗、字不變 */
</style>
