// 編年表、地圖兩個分頁共用的：資料、每個縣市的任期（連任合成一段）、總統、大事、照片、資訊卡的內容
import { reactive } from 'vue'
import H from './data/mayor-history.json'
import { EVENTS, PARTY_SHORT, PRESIDENTS } from './central.js'
import { COLOR, colorOf, sameRun, tagsOf, yr, ymd } from './parties.js'

export { H }
export const wiki = (title) => `https://zh.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`

// 臺北縣→新北市、桃園縣→桃園市是升格，同一欄
// 同一人在同一欄連任合成一格；縣市合併那天起算新的一格（合併後橫跨兩欄）
export function lines(terms) {
  const out = []
  for (const t of terms) {
    const last = out.findLast((x) => x.unit === t.unit)
    if (last && sameRun(last, t)) last.end = t.end, last.cuts.push(t.start)
    else out.push({ ...t, cuts: [] })
  }
  return out
}
// 各黨幾人次（同一人連任算一次；代理、非民選不算）
export const count = (() => {
  const out = {}
  for (const c of Object.values(H.counties)) for (const t of lines(c.terms.filter((t) => !t.acting && !t.note))) out[t.party] = (out[t.party] ?? 0) + 1
  return out
})()

// 每個縣市畫出來的任期（一段＝一人，連任合在一起）：縣轄市時期不畫（新竹市、嘉義市 1982-07-01 升格省轄市後才開始）
export const RUNS = Object.fromEntries(Object.entries(H.counties).map(([name, c]) => [name, lines(c.terms.filter((t) => t.start < H.asOf && t.note !== '縣轄市'))]))
// 格子、地圖上名字後面的註記：官派等、代理、補選、現任
export const termTags = (t) => [...tagsOf(t), t.end === H.asOf && '現任'].filter(Boolean)
// 點了開的網址：維基條目；表格裡沒連到條目的用名字搜尋
export const termUrl = (t) => (t.wiki ? wiki(t.wiki) : `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(t.name)}`)

// 時間範圍：最早的第一任民選 → 資料截止日；位置先算成「年」，畫的時候再乘上每年幾 px
export const Y0 = yr(Object.values(H.counties).reduce((m, c) => (c.from < m ? c.from : m), '9999')), Y1 = yr(H.asOf)
// 年（小數）→ 日期
export function fromYr(v) {
  const y = Math.floor(v), ms = Date.UTC(y, 0, 1) + (v - y) * (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1))
  return new Date(Math.round(ms / 864e5) * 864e5).toISOString().slice(0, 10)
}
// 連任的交界（下一任的就職日）：格子裡畫虛線；位置＝離格子頂端幾年
export const cutsOf = (dates, a, b) => dates.map((d) => yr(d) - Y0 - a).filter((v) => v > 0 && v < b - a)
// 總統（顏色＝中央執政黨）
export const PRES = PRESIDENTS.map((p) => {
  const a = Math.max(Y0, yr(p.start)) - Y0, b = Math.min(Y1, yr(p.end ?? H.asOf)) - Y0
  return { ...p, a, b, cuts: cutsOf(p.cuts ?? [], a, b), tip: `總統 ${p.name}（${PARTY_SHORT[p.party]}）${p.start}–${p.end ?? '現任'}${p.note ? `　${p.note}` : ''}` }
}).filter((p) => p.b > p.a)
// 大事（照時間排）
export const EVS = EVENTS.map((e) => ({ ...e, y: yr(e.date) - Y0, tip: `${ymd(e.date)}　${e.label}${e.note ? `：${e.note}` : ''}` })).filter((e) => e.y > 0 && e.y < Y1 - Y0).sort((a, b) => a.y - b.y)

// ── 照片：維基百科條目的主圖（pageimages，只有自由授權的圖），第一次用到時一次問完（一次最多 50 個條目）；沒有條目、沒有圖的就不放
export const photos = reactive({})
let asked = false
export async function loadPhotos() {
  if (asked) return
  asked = true
  const titles = [...new Set([...Object.values(RUNS).flatMap((r) => r.map((t) => t.wiki)).filter(Boolean), ...PRES.map((p) => p.name)])]
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

// ── 資訊卡的內容
// 在任多久：幾年幾個月
export function span(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number)
  const m = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
  return m < 1 ? '不到 1 個月' : `${m >= 12 ? `${Math.floor(m / 12)} 年` : ''}${m % 12 ? ` ${m % 12} 個月` : ''}`.trim()
}
// 生卒、歲數，寫成「生日-死亡 (XX歲)」（維基數據的出生、逝世日；只知道年的寫年、歲數加「約」；在世的死亡留空）：’27.06.10-’13.04.13 (85歲)／’64.12.23- (61歲)
export function life(key) {
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
// 卡片跟著游標；靠右、靠下時翻到另一邊，不超出畫面
export function tipPos(e) {
  const pos = e.clientX > innerWidth - 320 ? { right: `${innerWidth - e.clientX + 14}px` } : { left: `${e.clientX + 16}px` }
  return Object.assign(pos, e.clientY > innerHeight - 210 ? { bottom: `${innerHeight - e.clientY + 12}px` } : { top: `${e.clientY + 18}px` })
}
// 總統的卡片
export function presTip(p, pos) {
  const end = p.end ?? H.asOf
  return { pos, name: p.name, tags: p.end ? [] : ['現任'], color: COLOR[p.party], party: p.party === 'kmt' ? '中國國民黨' : '民主進步黨', unit: '中華民國總統', from: ymd(p.start), to: ymd(end, H.asOf), dur: span(p.start, end), terms: p.cuts.length + 1, note: p.note, photo: photos[p.name], life: life(p.name) }
}
// 縣市長的卡片（t＝RUNS 裡的一段）
export function termTip(t, pos) {
  return { pos, name: t.name, tags: termTags(t), color: colorOf(t), party: t.partyName, unit: `${t.unit}${t.unit.endsWith('市') ? '市長' : '縣長'}`, from: ymd(t.start), to: ymd(t.end, H.asOf), dur: span(t.start, t.end), terms: t.cuts.length + 1, photo: photos[t.wiki], life: life(t.wiki ?? t.name) }
}
