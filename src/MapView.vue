<template>
  <!-- 地圖分頁：左邊是跟編年表一樣的時間軸（年份、總統、大事），在上面點、拖選一天；右邊的臺灣地圖畫那一天各縣市的首長（顏色＝黨籍） -->
  <div class="pane">
    <ToolBar>
      <ModeTabs />
      <div class="tb-grp" role="group" aria-label="時間">
        <button type="button" class="btn btn-sm btn-tb" title="上一次首長變動（←）" :disabled="!prevDay" @click="go(prevDay)"><span class="material-symbols-outlined">skip_previous</span></button>
        <button type="button" class="btn btn-sm btn-tb" :class="{ active: playing }" :aria-pressed="playing" title="播放／暫停（空白鍵）" @click="toggle"><span class="material-symbols-outlined">{{ playing ? 'pause' : 'play_arrow' }}</span><span class="lbl">{{ playing ? '暫停' : '播放' }}</span></button>
        <button type="button" class="btn btn-sm btn-tb" title="下一次首長變動（→）" :disabled="!nextDay" @click="go(nextDay)"><span class="material-symbols-outlined">skip_next</span></button>
        <span class="day">{{ ymd(date) }}</span>
        <button type="button" class="btn btn-sm btn-tb" title="回到現在（資料截止日）" :disabled="date === H.asOf && !playing" @click="go(H.asOf)"><span class="material-symbols-outlined">restart_alt</span><span class="lbl">回到現在</span></button>
      </div>
      <div class="vr"></div>
      <div class="tb-grp" role="group" aria-label="地圖上顯示什麼">
        <button v-for="[k, l] in SHOW" :key="k" type="button" class="btn btn-sm btn-tb" :class="{ active: show[k] }" :aria-pressed="show[k]" :title="`顯示${l}`" @click="show[k] = !show[k]">{{ l }}</button>
      </div>
    </ToolBar>

    <div ref="split" class="split">
      <!-- 左：時間軸（跟編年表左邊凍結的三欄一樣），整段剛好一頁高；點、拖＝選日期 -->
      <div class="taxis" :class="{ scrubbing }" :style="{ width: `${AXIS}px` }">
        <div class="thead" :style="{ height: `${HEAD}px` }">
          <div class="head" :style="{ left: 0, width: `${YEAR_W}px` }"><b>年</b></div>
          <div class="head" :style="{ left: `${YEAR_W}px`, width: `${PRES_W}px` }"><b>總統</b></div>
          <div v-if="EV_W" class="head" :style="{ left: `${YEAR_W + PRES_W}px`, width: `${EV_W}px` }"><b>大事</b></div>
        </div>
        <div ref="tbody" class="tbody" @pointerdown="onScrub" @pointermove="onScrub" @pointerup="endScrub" @pointercancel="endScrub" @mousemove="onPresHover" @mouseleave="tip?.sheet || (tip = null)">
          <span v-for="y in ticks" :key="y" class="year" :title="y" :style="{ top: `${yy(y - Y0) * py}px`, width: `${YEAR_W}px` }">’{{ String(y).slice(2) }}</span>
          <div v-for="(p, i) in pres" :key="p.name" class="blk" :aria-label="p.tip" :data-p="i" :style="{ left: `${YEAR_W + 2}px`, width: `${PRES_W - 4}px`, top: `${top(p) * py}px`, height: `${p.h}px`, backgroundColor: COLOR[p.party] }">
            <i v-for="c in p.cuts" :key="c" class="cut" :style="{ top: `${cut(p, c) * py}px` }"></i>
            <span v-if="p.h >= 11"><b>{{ p.name }}</b><em v-if="!p.end" class="now">現任</em><small v-if="p.h >= 27">{{ dates(p)[0] }}</small><small v-if="p.h >= 36">{{ dates(p)[1] }}</small></span>
          </div>
          <svg v-if="EV_W" class="leads" :style="{ left: `${YEAR_W + PRES_W}px` }" width="12" height="1"><path v-for="e in events" :key="e.date + e.label" :class="e.kind" :d="`M1 ${e.p}L9 ${e.ly}`" /></svg>
          <div v-for="e in (EV_W ? events : [])" :key="e.date + e.label" class="ev" :class="[e.kind, { past: e.date > date }]" :title="e.tip" :style="{ left: `${YEAR_W + PRES_W}px`, top: `${e.ly}px` }"><small>{{ ymd(e.date) }}</small>{{ e.label }}</div>
          <!-- 選到的那一天 -->
          <div class="phead" :class="{ low: headY > size.th - 12, high: headY < 12 }" :style="{ top: `${Math.min(size.th - 1, headY)}px` }"><span>{{ ymd(date) }}</span></div>
        </div>
      </div>

      <!-- 右：地圖 -->
      <div ref="mapEl" class="map" :class="{ tiny }">
        <svg :width="size.w" :height="size.h" @mousemove="onMapHover" @mouseleave="hotKey = null, tip?.sheet || tip?.pin || (tip = null)" @click="onMapClick">
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
          <!-- 外島三縣的小框（左下角）：連江、金門、澎湖 -->
          <g v-for="b in layout.boxes" :key="b.name" class="inset">
            <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="12" />
          </g>
          <!-- 整塊陸地下面一圈黑影：浮在底上 -->
          <g class="land">
            <g v-for="s in shapes" :key="s.key" class="county" :class="{ sub: s.sub, none: !s.run }" :data-k="s.key">
              <!-- 本島的縣市：往裡縮＋浮雕（見上面的濾鏡）。外島小框裡的島很小，往裡縮會整個不見：不套濾鏡，改描一圈同色的邊讓它粗一點 -->
              <path :d="s.d" :fill="s.fill" :filter="s.sub || s.group !== 'main' ? null : 'url(#bevel)'" :stroke="s.group !== 'main' ? s.fill : null" :stroke-width="s.group !== 'main' ? 1.6 : null" stroke-linejoin="round" />
              <path v-if="s.run?.note" :d="s.d" fill="url(#hatch)" class="over" filter="url(#gap)" />
            </g>
          </g>
          <!-- 滑鼠移到的那個縣市：在所有縣市上面再畫一份，放大、變亮、浮起來（跟格子一樣；直接放大原本那一份會被旁邊的縣市蓋住） -->
          <g v-if="hot" :key="hot.key" class="lift">
            <path :d="hot.d" :fill="hot.fill" filter="url(#bevel)" />
            <path v-if="hot.run?.note" :d="hot.d" fill="url(#hatch)" filter="url(#gap)" />
          </g>
          <!-- 字畫在所有縣市上面 -->
          <!-- 字（和照片）：位置是 labels 排過的，互相不會蓋到；被推離原位比較遠的畫一條細線指回去 -->
          <g v-for="s in labels" :key="s.key" class="label">
            <line v-if="s.far" class="lead" :x1="s.x" :y1="s.ay" :x2="s.lx" :y2="s.cy" />
            <!-- 照片（開了「照片」、而且這位首長的維基條目有主圖）：一個圓形的頭像，放在字的上面，外圈是黨色 -->
            <g v-if="s.face" class="face">
              <circle :cx="s.lx" :cy="s.fy" :r="FACE / 2 + 1.5" :fill="s.ring" />
              <image :href="photos[s.run.wiki]" :x="s.lx - FACE / 2" :y="s.fy - FACE / 2" :width="FACE" :height="FACE" preserveAspectRatio="xMidYMin slice" />
            </g>
            <text v-if="unitOn || show.name" :x="s.lx" :y="s.ly">
              <tspan v-if="unitOn" class="unit" :x="s.lx">{{ s.unit }}</tspan>
              <tspan v-if="show.name && s.run" class="name" :x="s.lx" :dy="unitOn ? '1.15em' : 0">{{ s.run.name }}<tspan v-if="s.tag" class="tag" dx="2">{{ s.tag }}</tspan></tspan>
            </text>
          </g>
        </svg>
        <!-- 左上角：那一天的日期、總統、各黨幾個縣市 -->
        <div ref="sumEl" class="sum kcard">
          <div class="kcard-head"><b class="kcard-title">{{ ymd(date) }}</b><span v-if="president" class="kcard-sub"><i class="dot" :style="{ background: COLOR[president.party] }"></i>總統 {{ president.name }}</span></div>
          <div class="sum-tally">
            <span v-for="p in tally" :key="p.key"><i class="dot" :style="{ background: p.color }"></i>{{ p.label }} <b>{{ p.n }}</b></span>
          </div>
        </div>
        <!-- 右邊：滑鼠移到的那個縣市的歷任首長（移開後留著，可以捲；點一列＝跳到那一任就任那天） -->
        <aside v-if="panel" class="hist kcard">
          <!-- 標題整列是連到這個縣市維基百科的連結；外連圖示靠右（跟下面兩種的對齊同一條線） -->
          <a class="kcard-head" :href="wiki(panel.title)" target="_blank" rel="noopener" :title="`維基百科：${panel.title}`"><b class="kcard-title">{{ panel.title }}</b><span class="kcard-sub">歷任首長・{{ panel.rows.length }} 任</span><span class="material-symbols-outlined hn-link">open_in_new</span></a>
          <!-- 那一天在任的那一位：大的照片＋生卒、黨籍、任期（跟資訊卡同樣的內容） -->
          <a v-if="panel.now" class="hist-now" :href="panel.now.url" target="_blank" rel="noopener" :title="`維基百科：${panel.now.name}`">
            <img v-if="panel.now.photo" :src="panel.now.photo" alt="" />
            <span v-else class="ph">{{ panel.now.name[0] }}</span>
            <!-- 右上角的外連圖示（跟下面每一列最右邊的同一種、對齊同一條線） -->
            <span class="material-symbols-outlined hn-link">open_in_new</span>
            <span class="hn-body">
              <span class="hn-name">{{ panel.now.name }}<em v-for="g in panel.now.tags" :key="g">{{ g }}</em></span>
              <span v-if="panel.now.life" class="hn-dim">{{ panel.now.life }}</span>
              <span class="hn-row"><i class="dot" :style="{ background: panel.now.color }"></i>{{ panel.now.party }}</span>
              <span class="hn-row">{{ panel.now.from }} – {{ panel.now.to }}</span>
              <span class="hn-dim">在任 {{ panel.now.dur }}<template v-if="panel.now.terms > 1">・共 {{ panel.now.terms }} 任</template></span>
            </span>
          </a>
          <div ref="histList" class="hist-list">
            <div v-for="r in panel.rows" :key="r.t.unit + r.t.start" role="button" tabindex="0" class="hist-row" :class="{ on: r.on }" :title="`跳到 ${ymd(r.t.start)}`" @click="go(r.t.start)" @keydown.enter="go(r.t.start)">
              <i :class="{ acting: r.t.acting, noted: r.t.note }" :style="{ background: r.color }"></i>
              <!-- 照片（維基百科條目的主圖）；沒有的放一個字 -->
              <img v-if="photos[r.t.wiki]" class="hr-photo" :src="photos[r.t.wiki]" alt="" loading="lazy" />
              <span v-else class="hr-photo none">{{ r.t.name[0] }}</span>
              <span class="hr-main"><b>{{ r.t.name }}</b><em v-for="g in r.tags" :key="g">{{ g }}</em><small v-if="r.unit">{{ r.unit }}</small></span>
              <span class="hr-date">{{ ymd(r.t.start) }}<br>{{ ymd(r.t.end, H.asOf) }}</span>
              <!-- 開這個人的維基百科條目（沒有條目的＝用名字搜尋） -->
              <a class="hr-wiki" :href="termUrl(r.t)" target="_blank" rel="noopener" :title="`維基百科：${r.t.name}`" :aria-label="`維基百科：${r.t.name}`" @click.stop @keydown.enter.stop><span class="material-symbols-outlined">open_in_new</span></a>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <TipCard :tip="tip" @close="tip = null" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { geoMercator, geoPath } from 'd3-geo'
import TipCard from './TipCard.vue'
import ModeTabs from './ModeTabs.vue'
import ToolBar from './ToolBar.vue'
import { rev } from './mode.js'
import { plain, vacant } from './theme.js'
import NOW from './data/county-now.json'
import OLD from './data/county-2010.json'
import { COLOR, MERGED, MERGE_DAY, UNKNOWN, colorOf, yr, ymd } from './parties.js'
import { EVS, H, PRES, RUNS, Y0, Y1, fromYr, loadPhotos, photos, presTip, termTags, termTip, termUrl, tipPos, wiki } from './shared.js'

const YEAR_W = 28, HEAD = 40 // 年份欄的寬、欄名那一列的高（跟編年表一樣）
const NARROW = 720 // 畫面比這個窄＝手機版面
const SPEED = 2.5 // 播放：一秒走幾年
const CITY_SINCE = '1982-07-01' // 新竹市、嘉義市升格省轄市；之前是縣轄市，算在新竹縣、嘉義縣裡
const SHOW = [['unit', '縣市名'], ['name', '市長名'], ['color', '政黨色'], ['photo', '照片']]
const show = reactive({ unit: true, name: true, color: true, photo: false }) // 照片預設關（跟編年表一樣）

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
const split = ref(null), tbody = ref(null), mapEl = ref(null), sumEl = ref(null)
const size = reactive({ w: 800, h: 600, page: 1200, th: 600, sw: 240, sh: 96 }) // 地圖的寬高、整頁的寬、時間軸的高、左上角摘要那一塊的寬高
const compact = computed(() => size.page < NARROW)
const tiny = computed(() => size.h < 320) // 地圖很小（手機橫放）：字縮小，縣市名和首長名都開時只寫首長名
const HIST_W = 264 // 右邊「歷任首長」那一欄的寬
const wide = computed(() => size.w >= 620 && !tiny.value) // 畫面夠寬才有那一欄
// 頭像的直徑、圓心的位置（字的上面；沒有字就放在原本字的位置）
const FACE = computed(() => (tiny.value ? 16 : compact.value ? 22 : 30))
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
// 時間 → 位置：v＝離最早那一天幾年。遠到近照原樣；近到遠（預設）＝上下顛倒
const SPAN = Y1 - Y0
const yy = (v) => (rev.value ? SPAN - v : v)
const top = (b) => (rev.value ? SPAN - b.b : b.a) // 一格的上緣
const cut = (b, c) => (rev.value ? b.b - b.a - c : c) // 連任的虛線離上緣多遠
// 格子裡的兩行日期：上面那一行是格子上緣的日期（遠到近＝就任、卸任；近到遠＝卸任、就任）
const dates = (t) => { const d = [ymd(t.start), ymd(t.end ?? H.asOf, H.asOf)]; return rev.value ? d.reverse() : d }
const headY = computed(() => yy(tv.value - Y0) * py.value) // 選到的那一天在時間軸上的位置
const pres = computed(() => PRES.map((p) => ({ ...p, h: Math.max(1, (p.b - p.a) * py.value - 1) })))
const events = computed(() => {
  let prev = -99
  return EVS.map((e) => ({ ...e, p: yy(e.y) * py.value })).sort((a, b) => a.p - b.p).map((e) => ({ ...e, ly: (prev = Math.max(e.p, prev + 13)) }))
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
  tv.value = Math.min(Y1, Math.max(Y0, Y0 + yy(y / py.value)))
}
const endScrub = () => (scrubbing.value = false)

// ── 地圖
// 兩份界線：現在的 22 縣市；2010-12-25 縣市合併前的（臺中、臺南、高雄拆回縣、市）。離本島太遠的小島（東沙、南沙、釣魚臺、烏坵）不畫
const INSETS = ['連江縣', '金門縣', '澎湖縣'] // 外島三縣：另外畫在左下角的小框裡（照這個順序）
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
// 只有放不下字的小市要移到外面（往海那一邊）；其他縣市的字放在「離邊界最遠的那一點」（見 inner）
const NUDGE = { 基隆市: [24, -16], 新竹市: [-32, -6], 嘉義市: [-36, 0], '臺中市（合併前）': [-26, 0], '臺南市（合併前）': [-28, 4], '高雄市（合併前）': [-30, 8] }
// 一塊多邊形（畫面座標，第一圈是外框、其他是洞）裡面離邊界最遠的點：字放這裡最不會壓到界線。
// 形狀不規則的縣市（新北包著臺北、高雄細長）用重心會落在邊上甚至外面。做法：外框裡撒格點，留離所有邊最遠的那一個，再在它附近撒細一點的找一次
function inner(rings) {
  const seg = rings.flatMap((r) => r.slice(0, -1).map((a, i) => [a, r[i + 1]]))
  const inside = (x, y) => { let c = false; for (const [[x1, y1], [x2, y2]] of seg) if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c; return c }
  const dist = (x, y) => { let m = Infinity; for (const [[x1, y1], [x2, y2]] of seg) { const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1))); m = Math.min(m, (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2) } return m }
  const xs = rings[0].map((q) => q[0]), ys = rings[0].map((q) => q[1])
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), best = null
  for (let pass = 0; pass < 2; pass++) {
    const n = 16, sx = (x1 - x0) / n, sy = (y1 - y0) / n
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = x0 + i * sx, y = y0 + j * sy
      if (!inside(x, y)) continue
      const d = dist(x, y)
      if (!best || d > best.d) best = { x, y, d }
    }
    if (!best) return null
    x0 = best.x - sx, x1 = best.x + sx, y0 = best.y - sy, y1 = best.y + sy
  }
  return [best.x, best.y]
}
// 畫面大小 → 投影、每個縣市的路徑和字的位置（兩份界線都先算好）
const layout = computed(() => {
  const { w, h } = size, pad = 16, k = Math.min(1.4, Math.max(0.5, h / 800))
  const fc = (list) => ({ type: 'FeatureCollection', features: list.map((s) => ({ type: 'Feature', geometry: s.geometry })) })
  // 本島要避開蓋在地圖上的東西（左上的摘要、外島的小框、右邊的歷任首長），三種排法：
  // ・窄（手機直放）：摘要在上面、外島三個框在最下面排一排，本島放中間那一段
  // ・很矮（手機橫放）：摘要在左上、外島在左下排一排，本島放它們右邊
  // ・其他：外島在左下直排，本島放它們右邊（摘要在左上角，本島的西北邊是海，不會擋到）
  const stack = w < 620 && !tiny.value, row = stack || tiny.value
  const bw = row ? Math.round(Math.min(tiny.value ? 72 : 104, (w - 24 - 16) / 3)) : Math.round(Math.min(Math.min(130, w * 0.24), ((h - 24 - 20 - size.sh - 12) / 3) / 0.72))
  const bh = Math.round(bw * (row ? 0.66 : 0.72))
  const boxes = INSETS.map((name, i) => (row ? { name, x: 12 + i * (bw + 8), y: h - 12 - bh, w: bw, h: bh } : { name, x: 12, y: h - 12 - bh - (INSETS.length - 1 - i) * (bh + 10), w: bw, h: bh }))
  const rowW = 12 + 3 * bw + 16
  const x0 = stack ? pad : tiny.value ? Math.max(rowW, size.sw + 12) + 12 : 12 + bw + 16
  const y0 = stack ? 12 + size.sh + 14 : pad, y1 = stack ? h - 12 - bh - 14 : h - pad
  const x1 = w - pad - (wide.value ? HIST_W + 12 : 0)
  const main = geoMercator().fitExtent([[Math.min(x0, x1 - 60), y0], [x1, Math.max(y1, y0 + 60)]], fc(GEO.now.filter((s) => s.group === 'main')))
  const proj = { main }
  // 外島三個小框用同一個比例尺（三個縣之間可以比大小）：各自算「剛好放進框裡」的比例，取最小的那個給三個一起用，
  // 再各自把那個縣的外框中心對到框的中間（字上面那一塊）
  const isl = boxes.map((b) => ({ b, g: fc(GEO.now.filter((s) => s.group === b.name)) }))
  const scale = Math.min(...isl.map(({ b, g }) => geoMercator().fitExtent([[b.x + 8, b.y + 8], [b.x + b.w - 8, b.y + b.h - 22]], g).scale()))
  for (const { b, g } of isl) {
    const pr = geoMercator().scale(scale).translate([0, 0]), [[l, t], [r, bt]] = geoPath(pr).bounds(g)
    proj[b.name] = pr.translate([b.x + b.w / 2 - (l + r) / 2, b.y + 8 + (b.h - 30) / 2 - (t + bt) / 2])
  }
  const build = (list) => list.map((s) => {
    const path = geoPath(proj[s.group]), box = boxes.find((b) => b.name === s.group)
    // 字放在最大那一塊裡離邊界最遠的點（離島的小框：框的下緣）
    const big = s.geometry.coordinates.map((c) => ({ type: 'Polygon', coordinates: c })).reduce((a, b) => (path.area(b) > path.area(a) ? b : a))
    const pr = proj[s.group], [cx, cy] = (box ? null : inner(big.coordinates.map((r) => r.map((q) => pr(q))))) ?? path.centroid(big), [dx, dy] = NUDGE[s.key] ?? [0, 0]
    return { ...s, d: path({ type: 'Feature', geometry: s.geometry }), x: box ? box.x + box.w / 2 : cx + dx * k, y: box ? box.y + box.h - (unitOn.value && show.name ? 17 : 8) : cy + dy * k - (unitOn.value && show.name ? 3 : -4), cy: cy + dy * k }
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
    const c = run ? (show.color ? colorOf(run) : plain()) : vacant() // 不顯示政黨色＝灰；沒有首長（出缺、維基沒資料）＝底色（theme.js）
    return { ...s, sub, run, fill: run?.acting ? dim(c) : c, unit: run?.unit ?? s.name, tag: run ? termTags(run).filter((g) => g !== '現任').join('・') : '', ring: run ? colorOf(run) : VACANT }
  })
})
// 字（和照片）排位置：每個縣市的字佔一個方框（照片在上、縣市名、首長名），從原本的位置（縣市裡面）出發，
// 兩個方框疊到就互相推開（往疊得比較少的那個方向各退一半），同時有一點拉回原位的力；跑兩百多輪（最後幾十輪不再拉回去，只推開）就不會互相蓋到。
// 外島小框裡的不動。
const labels = computed(() => {
  const F = FACE.value, name = show.name, unit = unitOn.value, fs = tiny.value ? 9 : compact.value ? 10 : 12
  const list = shapes.value.filter((s) => !s.sub).map((s) => {
    const face = !!(show.photo && s.run && photos[s.run.wiki])
    const tw = Math.max(unit ? s.unit.length * fs * 0.86 : 0, name && s.run ? s.run.name.length * fs * 1.04 + (s.tag ? s.tag.length * fs * 0.78 + 4 : 0) : 0)
    const th = (unit ? fs * 0.95 : 0) + (name && s.run ? fs * 1.2 : 0), fh = face ? F + 5 : 0
    // 方框：中心 (x, y)、半寬 hw、半高 hh。整個方框（照片＋字）的中心對在縣市裡面最空的那一點（s.x, s.cy）；
    // 外島小框裡的：字貼著框的下緣，照片往上疊
    const y0 = s.group === 'main' ? s.cy : s.y - fs * 0.85 - fh + (fh + th) / 2
    return { s, face, fh, th, hw: Math.max(tw, face ? F + 4 : 0) / 2 + 3, hh: (fh + th) / 2 + 2, x: s.x, y: y0, x0: s.x, y0, fixed: s.group !== 'main' }
  })
  for (let it = 0; it < 240; it++) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const A = list[a], B = list[b]
      if (A.fixed && B.fixed) continue
      const ox = A.hw + B.hw - Math.abs(A.x - B.x), oy = A.hh + B.hh - Math.abs(A.y - B.y)
      if (ox <= 0 || oy <= 0) continue
      const wa = A.fixed ? 0 : B.fixed ? 1 : 0.5, wb = 1 - wa
      if (ox < oy) { const d = A.x <= B.x ? -ox : ox; A.x += d * wa; B.x -= d * wb } else { const d = A.y <= B.y ? -oy : oy; A.y += d * wa; B.y -= d * wb }
    }
    for (const L of list) if (!L.fixed) { const k = it < 200 ? 0.03 : 0; L.x += (L.x0 - L.x) * k; L.y += (L.y0 - L.y) * k; L.x = Math.min(size.w - L.hw - 2, Math.max(L.hw + 2, L.x)); L.y = Math.min(size.h - L.hh - 2, Math.max(L.hh + 2, L.y)) }
  }
  return list.map((L) => {
    const top = L.y - (L.fh + L.th) / 2
    return { ...L.s, face: L.face, lx: L.x, ly: top + L.fh + fs * 0.85, fy: top + F / 2 + 1, cy: L.y, ay: L.y0, far: Math.hypot(L.x - L.x0, L.y - L.y0) > 16 }
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
// 右邊那一欄：最後移到的那個縣市（縣轄市時期的新竹市、嘉義市＝看新竹縣、嘉義縣）
const pinKey = ref(null), histList = ref(null)
const panel = computed(() => {
  // 時間跨過 2010 年縣市合併，界線換了一份、那一塊的名字不一樣：改找同一個縣市的
  const s = wide.value && (shapes.value.find((x) => x.key === pinKey.value) ?? shapes.value.find((x) => x.county === pinKey.value?.replace('（合併前）', '')))
  if (!s) return null
  // 合併前的縣、市只列自己那一邊；現在的臺中、臺南、高雄市列全部（合併前兩邊都有，後面標是哪一邊）
  const list = RUNS[s.county].filter((t) => !s.unit || t.unit === s.unit), mixed = new Set(list.map((t) => t.unit)).size > 1
  return { title: s.run?.unit ?? s.name, now: s.run ? termTip(s.run, {}) : null, rows: list.map((t) => ({ t, on: t === s.run, color: colorOf(t), tags: termTags(t), unit: mixed ? t.unit : '' })) }
})
// 換縣市、換時間：捲到在任的那一列
watch(() => [pinKey.value, panel.value?.rows.find((r) => r.on)?.t.start], () => nextTick(() => histList.value?.querySelector('.on')?.scrollIntoView({ block: 'nearest' })))
const shapeOf = (e) => { const k = e.target.closest?.('[data-k]')?.dataset.k; return k && shapes.value.find((s) => s.key === k) }
function onMapHover(e) {
  if (tip.value?.sheet || tip.value?.pin) return // 固定住的卡：留著
  const s = shapeOf(e)
  hotKey.value = s?.run ? s.key : null
  if (s) pinKey.value = s.sub ? `${s.county.slice(0, 2)}縣` : s.key
  tip.value = s?.run && !wide.value ? termTip(s.run, tipPos(e)) : null // 有右邊那一欄就不另外跳卡片（資料在那一欄最上面）
}
function onMapClick(e) {
  const s = shapeOf(e)
  // 點縣市不直接開維基（要開：右邊那一欄、資訊卡上的連結）。
  // 觸控：把資訊卡固定在點的地方旁邊（跟電腦一樣的卡），點空白把卡收掉；滑鼠：選這個縣市（右邊那一欄換成它，跟滑過去一樣）
  if (e.pointerType === 'touch' || e.pointerType === 'pen') tip.value = s?.run ? { ...termTip(s.run, tipPos(e)), pin: true } : null
  else if (s && wide.value) pinKey.value = s.sub ? `${s.county.slice(0, 2)}縣` : s.key
  else tip.value = s?.run ? { ...termTip(s.run, tipPos(e)), pin: true } : null // 沒有右邊那一欄（視窗窄）：把資訊卡固定住，卡上有連結
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
    size.sw = sumEl.value.offsetWidth, size.sh = sumEl.value.offsetHeight
  })
  ro.observe(split.value)
  ro.observe(mapEl.value)
  ro.observe(sumEl.value)
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
.day { min-width: 78px; padding: 0 12px; line-height: 30px; box-shadow: inset 1px 0 0 var(--tb-line); color: var(--tb-text); font-size: 13px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; }
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
.map { flex: 1; min-width: 0; position: relative; overflow: hidden; background: radial-gradient(ellipse at 55% 45%, var(--map-glow) 0, transparent 68%), var(--bg); }
.map svg { display: block; }
.inset rect { fill: var(--card-bg); stroke: var(--card-line); } /* 跟卡片同一組底、框、圓角 */
.land { filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35)); }
.county path { cursor: default; transition: fill 0.25s; } /* 縣市之間不描線：每個縣市往裡縮 0.5px（濾鏡），中間留 1px 的間隙 */
.county .over { pointer-events: none; transition: none; }
.county.sub path { stroke: none; } /* 縣轄市時期的新竹市、嘉義市：併在縣裡，不畫界線 */
.county.none path { cursor: default; }
/* 滑鼠移上去：變亮 15%、浮起來（縣市比格子大很多，只放大 3%，不然會蓋住旁邊的縣市） */
.lift { pointer-events: none; transform-box: fill-box; transform-origin: center; transform: scale(1.03); filter: brightness(1.15) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55)); animation: lift 0.12s ease-out; }
@keyframes lift { from { transform: scale(1); filter: brightness(1) drop-shadow(0 0 0 rgba(0, 0, 0, 0)); } }
@media (hover: none) { .lift { display: none; } }
.label { pointer-events: none; }
.label .lead { stroke: var(--muted); stroke-width: 1; opacity: 0.7; }
.face image { clip-path: circle(50%); }
.face circle { stroke: rgba(14, 14, 15, 0.85); stroke-width: 1; }
.face { filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
.label text { text-anchor: middle; fill: #fff; paint-order: stroke; stroke: rgba(0, 0, 0, 0.72); stroke-width: 2.6px; stroke-linejoin: round; font-size: 12px; letter-spacing: 0.02em; }
.label .unit { fill: rgba(255, 255, 255, 0.82); font-size: 10px; font-weight: 500; }
.label .name { font-weight: 700; }
.map.tiny .label text { font-size: 9px; stroke-width: 2px; }
.map.tiny .sum { max-width: 190px; padding: 6px 8px; font-size: 11px; }
.map.tiny .sum .kcard-title { font-size: 14px; }
.map.tiny .sum-tally { margin-top: 3px; padding-top: 3px; }
.label .tag { fill: #ffe27a; font-size: 9px; font-weight: 600; }
/* 地圖上的卡片：左上的摘要、右邊的歷任首長（樣子在 style.css 的 .card；外島的小框是同一組底、框、圓角） */
.kcard-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
.kcard-sub { display: inline-flex; align-items: center; gap: 6px; }
.sum { position: absolute; left: 12px; top: 12px; max-width: 250px; padding: var(--card-pad); font-size: 12px; line-height: 1.6; pointer-events: none; }
.sum-tally { display: flex; flex-wrap: wrap; gap: 2px 12px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--card-line); color: var(--muted); }
.sum-tally span { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.sum-tally b { color: var(--text); font-variant-numeric: tabular-nums; }
/* 右邊：歷任首長（跟摘要一樣的毛玻璃卡片） */
.hist { position: absolute; right: 12px; top: 12px; bottom: 12px; width: v-bind("HIST_W + 'px'"); display: flex; flex-direction: column; font-size: 12px; overflow: hidden; }
.hist .kcard-head { flex: none; padding: var(--card-pad); border-bottom: 1px solid var(--card-line); }
.hist-list { flex: 1; min-height: 0; overflow-y: auto; padding: 6px; scrollbar-width: thin; scrollbar-color: rgba(var(--fg), 0.28) transparent; }
.hist-row { display: flex; align-items: center; gap: 8px; width: 100%; margin-bottom: 1px; padding: 4px 6px; border: 0; border-radius: 8px; background: transparent; color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: transform 0.12s ease-out, background-color 0.12s; }
.hist-row:hover { background: rgba(var(--fg), 0.07); }
.hist-row.on { background: rgba(var(--fg), 0.12); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14); } /* 那一天在任的 */
.hist-row i { flex: none; position: relative; width: 6px; align-self: stretch; border-radius: 2px; overflow: hidden; }
.hist-row i.noted { background-image: repeating-linear-gradient(135deg, rgba(14, 14, 15, 0.55) 0 2px, transparent 2px 5px); }
.hist-row i.acting::after { content: ''; position: absolute; inset: 0; background: rgba(14, 14, 15, 0.45); }
.hr-photo { flex: none; width: 30px; height: 38px; border-radius: 6px; object-fit: cover; object-position: top; background: var(--btn); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14); }
.hr-photo.none { display: grid; place-items: center; color: var(--dim); font-size: 14px; }
.hist-now { position: relative; flex: none; display: flex; gap: 12px; padding: var(--card-pad); border-bottom: 1px solid var(--card-line); color: var(--text); transition: background-color 0.12s; }
.hist-now:hover { background: rgba(var(--fg), 0.05); }
.hist-now img, .hist-now .ph { flex: none; width: 76px; height: 100px; border-radius: 8px; object-fit: cover; object-position: top; background: var(--btn); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); }
.hist-now .ph { display: grid; place-items: center; color: var(--dim); font-size: 26px; }
.hn-body { min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: 12px; line-height: 1.5; }
.hn-name { padding-right: 26px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin-bottom: 2px; font-size: 17px; font-weight: 700; line-height: 1.3; }
.hn-name em { padding: 1px 6px; border-radius: 999px; background: rgba(var(--fg), 0.1); color: var(--muted); font-style: normal; font-size: 10.5px; font-weight: 500; }
.hn-row { display: flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; white-space: nowrap; }
/* 卡片右上角的外連圖示（跟下面每一列最右邊的一樣）：整張卡片是連到維基百科的連結 */
.hn-link { position: absolute; right: 12px; top: 12px; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--dim); font-size: 16px; transition: background-color 0.12s, color 0.12s; }
.hist .kcard-head { position: relative; padding-right: 44px; color: var(--text); }
.hist .kcard-head .hn-link { top: 50%; translate: 0 -50%; }
.hist .kcard-head:hover .hn-link, .hist-now:hover .hn-link { background: rgba(var(--fg), 0.12); color: var(--text); }
.hn-dim { color: var(--muted); font-variant-numeric: tabular-nums; }
.hr-main { flex: 1; min-width: 0; line-height: 1.35; }
.hr-main b { font-weight: 600; }
.hr-main em { margin-left: 4px; padding: 0 4px; border-radius: 999px; background: rgba(var(--fg), 0.1); color: var(--muted); font-style: normal; font-size: 10px; white-space: nowrap; }
.hr-main small { display: block; color: var(--dim); font-size: 10px; }
.hr-wiki { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--dim); transition: background-color 0.12s, color 0.12s; }
.hr-wiki:hover { background: rgba(var(--fg), 0.12); color: var(--text); }
.hr-wiki .material-symbols-outlined { font-size: 16px; }
.hr-date { flex: none; color: var(--text); opacity: 0.8; font-size: 10.5px; line-height: 1.25; text-align: right; font-variant-numeric: tabular-nums; }
@media (max-width: 720px) {
  .sum { left: 8px; top: 8px; max-width: 170px; padding: 8px; font-size: 11px; }
  .sum .kcard-title { font-size: 15px; }
  .label text { font-size: 10px; }
  .label .unit { font-size: 8.5px; }
}
</style>
