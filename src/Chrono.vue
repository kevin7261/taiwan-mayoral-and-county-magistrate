<template>
  <!-- 22 縣市歷任首長編年總表：像試算表——上面一列（縣市）、左邊三欄（年份、總統、大事）凍結，其他照一般捲動；下面的列放圖例、顯示什麼、字級和縮放 -->
  <div class="page">
    <header class="bar">
      <h1>臺灣縣市長編年表</h1>
    </header>
    <!-- 工具列（Bootstrap 元件、Material Symbols 圖示）：顯示什麼、字級、縮放、滾輪縮放模式／拖曳模式、回到預設 -->
    <div class="toolbar">
      <div class="ctl" role="toolbar" aria-label="工具列">
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
          <button type="button" class="btn btn-sm btn-tb" :class="{ active: wheel }" :aria-pressed="wheel" title="開：滾輪＝縮放（以游標為中心）；關：滾輪＝一般捲動" @click="wheel = !wheel">滾輪縮放模式</button>
          <button type="button" class="btn btn-sm btn-tb" :class="{ active: nav }" :aria-pressed="nav" title="開：按住拖曳＝移動（表的四周可以拖出去）；關：不能拖" @click="setNav(!nav)">拖曳模式</button>
        </div>
        <div class="vr"></div>
        <button type="button" class="btn btn-sm btn-tb" title="縮放 100%、字級、顯示項目、滾輪縮放模式、拖曳模式都回到預設（0）" :disabled="isDefault" @click="reset"><span class="material-symbols-outlined">restart_alt</span><span class="lbl">回到預設</span></button>
      </div>
    </div>

    <div ref="scroller" class="scroller" :class="{ dragging, nav }" tabindex="0" :style="{ fontSize: `${11 * f}px` }"
      @wheel="onWheel" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @mousemove="onHover" @mouseleave="tip = null" @scroll="tip = null">
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

    <!-- 滑鼠移到格子上的資訊卡：照片（維基百科條目的主圖，有才放）、名字、註記、黨籍、任期 -->
    <div v-if="tip" class="tipcard" :style="tip.pos">
      <img v-if="tip.photo" :src="tip.photo" alt="" />
      <div class="tc-body">
        <div class="tc-name">{{ tip.name }}<span v-for="g in tip.tags" :key="g" class="badge">{{ g }}</span></div>
        <div v-if="tip.life" class="tc-row tc-life">{{ tip.life }}</div>
        <div class="tc-row"><i :style="{ background: tip.color }"></i>{{ tip.party }}</div>
        <div class="tc-row tc-unit">{{ tip.unit }}</div>
        <div class="tc-row tc-date">{{ tip.from }} – {{ tip.to }}</div>
        <div class="tc-row tc-dim">在任 {{ tip.dur }}<template v-if="tip.terms > 1">・連任，共 {{ tip.terms }} 任</template></div>
        <div v-if="tip.note" class="tc-row tc-dim">{{ tip.note }}</div>
        <div class="tc-row tc-link"><span class="material-symbols-outlined">open_in_new</span>點一下開維基百科</div>
      </div>
    </div>

    <footer class="foot">
      <span v-for="p in H.parties.filter((p) => count[p.key])" :key="p.key" class="lg" :title="`${count[p.key] ?? 0} 人次（民選，同一人連任算一次）`"><i :style="{ background: COLOR[p.key] }"></i>{{ p.label }}</span>
      <span class="lg"><i :style="{ background: UNKNOWN }"></i>黨籍不詳</span>
      <span class="lg"><i class="acting" :style="{ background: COLOR.kmt }"></i>代理</span>
      <span class="lg"><i class="noted" :style="{ background: COLOR.kmt }"></i>非民選</span>
      <span class="credit">
        <span class="ver" title="版本">v{{ VERSION }}</span>
        <a href="https://github.com/szfftz/taiwan-mayoral-and-county-magistrate" target="_blank" rel="noopener">szfftz</a>
      </span>
    </footer>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import H from './data/mayor-history.json'
import { EVENTS, PARTY_SHORT, PRESIDENTS } from './central.js'
import { COLOR, MERGED, MERGE_DAY, UNKNOWN, colorOf, sameRun, tagsOf, yr, ymd } from './parties.js'

const VERSION = __APP_VERSION__ // package.json 的 version（vite.config.js 的 define）
const ACTING_DIM = 0.45 // 代理：黨色上面蓋一層 45% 的黑
const PLAIN = '#4a4c4b' // 不顯示政黨色時格子的顏色
const YEAR_W = 28, HEAD = 40 // 年份欄的寬、上面縣市名那一列的高（100%、預設字級時的 px）
const MIN_COL = 50, MIN_YEAR = 11 // 100% 時一欄最少幾 px、一年最少幾 px：畫面小就用捲的，不硬擠
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

// 縣轄市時期不畫（新竹市、嘉義市 1982-07-01 升格省轄市後才開始）
// 時間範圍：最早的第一任民選 → 資料截止日；格子的位置先算成「年」（a、b），畫的時候再乘上每年幾 px
const Y0 = yr(Object.values(H.counties).reduce((m, c) => (c.from < m ? c.from : m), '9999')), Y1 = yr(H.asOf)
// 連任的交界（下一任的就職日）：格子裡畫虛線；位置＝離格子頂端幾年
const cutsOf = (dates, a, b) => dates.map((d) => yr(d) - Y0 - a).filter((v) => v > 0 && v < b - a)
const blocks = cols.flatMap((c) => lines(H.counties[c.name].terms.filter((t) => t.start < H.asOf && t.note !== '縣轄市')).map((t) => {
  const after = c.units.length > 1 && t.unit === c.name && t.start >= MERGE_DAY
  const a = Math.max(Y0, yr(t.start)) - Y0, b = Math.min(Y1, yr(t.end)) - Y0
  return {
    id: t.unit + t.start, t, a, b, color: colorOf(t), tags: [...tagsOf(t), t.end === H.asOf && '現任'].filter(Boolean), cuts: cutsOf(t.cuts, a, b),
    col: c.col + (after || c.units.length === 1 ? 0 : c.units.indexOf(t.unit)), span: after ? c.units.length : 1,
    url: t.wiki ? wiki(t.wiki) : `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(t.name)}`, // 表格裡沒連到條目的：用名字搜尋
    tip: `${t.unit}　${t.start}–${t.end === H.asOf ? '現任' : t.end}　${tagsOf(t).map((g) => `${g} `).join('')}${t.name}（${t.partyName}）`,
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
// 100% 時格子區的寬、高（畫面扣掉凍結的欄、列）。寬：桌機一定剛好放進畫面（預設不會有橫的捲軸），手機版面才用最小欄寬；高：太矮就用最小列高，上下捲
const bw0 = computed(() => Math.max(compact.value ? N * MIN_COL : 100, size.w - AXIS.value * fs.value - 1)), bh0 = computed(() => Math.max((Y1 - Y0) * MIN_YEAR, size.h - HEAD * fs.value - 2))
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
const PRES = PRESIDENTS.map((p) => {
  const a = Math.max(Y0, yr(p.start)) - Y0, b = Math.min(Y1, yr(p.end ?? H.asOf)) - Y0
  return { ...p, a, b, cuts: cutsOf(p.cuts ?? [], a, b), tip: `總統 ${p.name}（${PARTY_SHORT[p.party]}）${p.start}–${p.end ?? '現任'}${p.note ? `　${p.note}` : ''}` }
}).filter((p) => p.b > p.a)
const pres = computed(() => PRES.map(sized))
// 大事：照時間排，跟上一個不到一行就往下推
const EVS = EVENTS.map((e) => ({ ...e, y: yr(e.date) - Y0, tip: `${ymd(e.date)}　${e.label}${e.note ? `：${e.note}` : ''}` })).filter((e) => e.y > 0 && e.y < Y1 - Y0).sort((a, b) => a.y - b.y)
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
// 開關拖曳模式：四周的空白跟著有、沒有，畫面左上角那一點留在原地
function setNav(v) {
  anchor(axisW.value, headH.value)
  nav.value = v
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
// 照片：維基百科條目的主圖（pageimages，只有自由授權的圖），載入後一次問完（一次最多 50 個條目）；沒有條目、沒有圖的就不放
const photos = reactive({})
async function loadPhotos() {
  const titles = [...new Set([...blocks.map((b) => b.t.wiki).filter(Boolean), ...PRES.map((p) => p.name)])]
  for (let i = 0; i < titles.length; i += 50) {
    const part = titles.slice(i, i + 50)
    try {
      const q = new URLSearchParams({ action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '240', pilimit: '50', redirects: '1', titles: part.join('|'), format: 'json', formatversion: '2', origin: '*' })
      const d = (await (await fetch(`https://zh.wikipedia.org/w/api.php?${q}`)).json()).query ?? {}
      // 條目名被正規化、重新導向時，回來的名字跟問的不一樣：一路對回去
      const to = {}
      for (const m of [...(d.normalized ?? []), ...(d.redirects ?? [])]) to[m.from] = m.to
      const src = Object.fromEntries((d.pages ?? []).map((pg) => [pg.title, pg.thumbnail?.source]))
      for (const t of part) {
        let k = t
        for (let n = 0; n < 4 && to[k]; n++) k = to[k]
        if (src[k]) photos[t] = src[k]
      }
    } catch { /* 沒網路、被擋：就不放照片 */ }
  }
}
// 在任多久：幾年幾個月
function span(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number)
  const m = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
  return m < 1 ? '不到 1 個月' : `${m >= 12 ? `${Math.floor(m / 12)} 年` : ''}${m % 12 ? ` ${m % 12} 個月` : ''}`.trim()
}
// 格子的底：黨色（不顯示政黨色＝灰）；非民選加斜線；開了「照片」而且有照片：照片鋪滿，上面蓋一層黨色（上濃下淡，字在上面看得清楚）
const HATCH = 'repeating-linear-gradient(135deg, rgba(22, 22, 22, 0.4) 0 2px, transparent 2px 6px)'
function bg(color, title, note) {
  const c = show.color ? color : PLAIN, photo = show.photo && photos[title]
  const img = [note && HATCH, photo && `linear-gradient(${c}f2 0, ${c}b3 2.5em, ${c}33 6em)`, photo && `url("${photo}")`].filter(Boolean)
  return { backgroundColor: c, ...(img.length ? { backgroundImage: img.join(', '), backgroundSize: img.map((_, i) => (photo && i === img.length - 1 ? 'cover' : 'auto')).join(', '), backgroundPosition: 'center top' } : {}) }
}
// 生卒、歲數，寫成「生日-死亡 (XX歲)」（維基數據的出生、逝世日；只知道年的寫年、歲數加「約」；在世的死亡留空）：’27.06.10-’13.04.13 (85歲)／’64.12.23- (61歲)
function life(key) {
  const w = H.people?.[key]
  if (!w?.born && !w?.died) return ''
  const day = (d) => (d ? ymd(d) : '')
  let age = ''
  if (w.born) {
    const end = w.died ?? H.asOf, exact = w.born.length > 4 && end.length > 4
    const n = +end.slice(0, 4) - +w.born.slice(0, 4) - (exact && end.slice(5) < w.born.slice(5) ? 1 : 0)
    age = ` (${exact ? '' : '約'}${n}歲)`
  }
  return `${day(w.born)}-${day(w.died)}${age}`
}
const tip = ref(null)
function onHover(e) {
  const el = dragging.value ? null : e.target.closest?.('[data-i], [data-p]')
  if (!el) return (tip.value = null)
  // 卡片跟著游標；靠右、靠下時翻到另一邊，不超出畫面
  const pos = e.clientX > innerWidth - 320 ? { right: `${innerWidth - e.clientX + 14}px` } : { left: `${e.clientX + 16}px` }
  Object.assign(pos, e.clientY > innerHeight - 210 ? { bottom: `${innerHeight - e.clientY + 12}px` } : { top: `${e.clientY + 18}px` })
  if (el.dataset.p != null) {
    const p = PRES[el.dataset.p], end = p.end ?? H.asOf
    tip.value = { pos, name: p.name, tags: p.end ? [] : ['現任'], color: COLOR[p.party], party: p.party === 'kmt' ? '中國國民黨' : '民主進步黨', unit: '中華民國總統', from: ymd(p.start), to: ymd(end, H.asOf), dur: span(p.start, end), terms: p.cuts.length + 1, note: p.note, photo: photos[p.name], life: life(p.name) }
  } else {
    const b = blocks[el.dataset.i], t = b.t
    tip.value = { pos, name: t.name, tags: b.tags, color: b.color, party: t.partyName, unit: `${t.unit}${t.unit.endsWith('市') ? '市長' : '縣長'}`, from: ymd(t.start), to: ymd(t.end, H.asOf), dur: span(t.start, t.end), terms: b.cuts.length + 1, photo: photos[t.wiki], life: life(t.wiki ?? t.name) }
  }
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
.page { display: flex; flex-direction: column; height: 100%; }
.bar, .foot, .toolbar { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 6px 12px; font-size: 12px; background: var(--chrome); }
.bar { justify-content: center; border-bottom: 1px solid var(--line); } /* 標題放中間 */
.toolbar { padding: 6px 10px; border-bottom: 1px solid var(--line); background: var(--bg); }
.foot { border-top: 1px solid var(--line); padding: 4px 12px; }
.bar h1 { margin: 0; text-align: center; font-size: 15px; font-weight: 700; line-height: 1.5; }
.lg { display: flex; align-items: center; gap: 5px; color: var(--muted); white-space: nowrap; }
.lg i { width: 14px; height: 10px; border-radius: 2px; }
.lg i.noted { background-image: repeating-linear-gradient(135deg, rgba(22, 22, 22, 0.4) 0 2px, transparent 2px 6px); }
.lg i.acting { box-shadow: inset 0 0 0 20px rgba(22, 22, 22, 0.45); }
/* 工具列（Bootstrap 的 btn、vr、form-range）：一條圓角的底，裡面是扁平的圖示按鈕，一組一組用直線隔開 */
.ctl { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; width: fit-content; max-width: 100%; padding: 3px 8px; border-radius: 999px; background: var(--chrome); box-shadow: inset 0 0 0 1px var(--line); }
.tb-grp { display: flex; align-items: center; gap: 2px; }
.ctl .vr { align-self: center; height: 18px; margin: 0 2px; color: #fff; }
.ctl .form-range { width: 110px; margin: 0 4px; }
.pct { min-width: 40px; padding-right: 4px; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }

.credit { display: flex; gap: 14px; margin-left: auto; padding-left: 12px; white-space: nowrap; }
.credit { gap: 8px; }
.credit .ver { color: var(--dim); font-variant-numeric: tabular-nums; }
.credit a { color: var(--dim); }
.credit a:hover { color: var(--accent); }
.lbl-s { display: none; }
/* 手機版面：按鈕只留圖示；工具列、圖例不換行，放不下用滑的 */
@media (max-width: 720px) {
  .lbl { display: none; }
  .lbl-s { display: inline; }
  .bar { flex-wrap: nowrap; }
  .bar h1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .toolbar, .foot, .ctl { flex-wrap: nowrap; }
  .toolbar, .foot { overflow-x: auto; scrollbar-width: none; }
  .toolbar::-webkit-scrollbar, .foot::-webkit-scrollbar { display: none; }
  .ctl { width: max-content; max-width: none; }
  .ctl > * { flex: none; }
  .ctl .form-range { width: 72px; }
}

.scroller { flex: 1; min-height: 0; overflow: auto; scrollbar-gutter: stable; outline: 0; cursor: default; user-select: none; -webkit-user-select: none; overscroll-behavior: contain; }
.scroller.nav { cursor: grab; }
.scroller.dragging, .scroller.dragging * { cursor: grabbing !important; }
/* 捲軸：細、圓角、深色，滑鼠移上去才亮一點（Firefox 沒有 ::-webkit-scrollbar，用標準寫法） */
.scroller::-webkit-scrollbar { width: 12px; height: 12px; }
.scroller::-webkit-scrollbar-track, .scroller::-webkit-scrollbar-corner { background: transparent; }
.scroller::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 6px; background: rgba(255, 255, 255, 0.22); background-clip: content-box; }
.scroller::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.4); }
.scroller::-webkit-scrollbar-thumb:active { background-color: var(--accent); }
@supports (-moz-appearance: none) { .scroller { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.28) transparent; } }
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
.blk { position: absolute; overflow: clip; transition: transform 0.12s ease-out, filter 0.12s, box-shadow 0.12s; border-radius: 2px; color: #fff; line-height: 1.2; cursor: pointer; }
/* 滑鼠移上去：那一格放大、變亮、浮起來（不畫白框） */
.blk:hover { z-index: 1; transform: scale(1.12); filter: brightness(1.15); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6); }
/* 名字：四邊跟格子留 Bootstrap 的 p-1（0.25rem）；格子比畫面長、捲過頭時留在看得到的地方（貼著凍結的列、欄）；
   註記接在名字後面，欄太窄放不下就折到下一行 */
.blk span { position: sticky; display: block; width: fit-content; max-width: 100%; padding: 0.25rem; text-shadow: 0 0 2px rgba(0, 0, 0, 0.5); }
.blk b { font-weight: inherit; white-space: nowrap; }
.blk small { display: block; line-height: 1.1; white-space: nowrap; opacity: 0.8; font-size: 0.77em; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.blk .cut { position: absolute; left: 0; right: 0; border-top: 1px dashed rgba(255, 255, 255, 0.6); } /* 連任的交界 */
.blk.noted { background-image: repeating-linear-gradient(135deg, rgba(22, 22, 22, 0.4) 0 2px, transparent 2px 6px); } /* 非民選：黨色＋斜線 */
.blk em { display: inline-block; margin-left: 1px; padding: 0 1px; vertical-align: 0.1em; border-radius: 2px; background: rgba(22, 22, 22, 0.75); font-style: normal; font-size: 0.7em; letter-spacing: -0.03em; white-space: nowrap; } /* 註記（官派、代理、補選、現任）：接在名字後面 */
.blk em.now { padding: 0; background: none; opacity: 0.9; } /* 現任：不要黑底 */
.blk.acting::before { content: ''; position: absolute; inset: 0; background: rgba(22, 22, 22, v-bind(ACTING_DIM)); } /* 代理：黨色壓暗、字不變 */
/* 資訊卡 */
.tipcard { position: fixed; z-index: 20; display: flex; gap: 12px; width: max-content; max-width: 300px; padding: 12px; border: 1px solid #3a3d3f; border-radius: 10px; background: rgba(28, 30, 31, 0.97); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55); color: var(--text); font-size: 12px; line-height: 1.5; pointer-events: none; }
.tipcard img { flex: none; width: 72px; height: 96px; border-radius: 6px; object-fit: cover; object-position: top; background: #2a2c2d; }
.tc-body { min-width: 0; }
.tc-name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 16px; font-weight: 700; line-height: 1.3; }
.tc-name .badge { padding: 2px 6px; border-radius: 4px; background: #3d4144; color: var(--text); font-size: 11px; font-weight: 500; }
.tc-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.tc-row i { flex: none; width: 10px; height: 10px; border-radius: 2px; }
.tc-unit { color: var(--muted); }
.tc-life { margin: -2px 0 4px; color: var(--muted); font-variant-numeric: tabular-nums; }
.tc-date { margin-top: 4px; font-variant-numeric: tabular-nums; }
.tc-dim { color: var(--dim); white-space: normal; }
.tc-link { margin-top: 6px; gap: 3px; color: var(--accent); font-size: 11px; }
.tc-link .material-symbols-outlined { font-size: 14px; }
</style>
