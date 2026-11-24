// 政黨顏色
export const COLOR = { kmt: '#2171b5', dpp: '#238b45', tpp: '#28c8c8', ind: '#8c8c8c', pfp: '#f07c1b', np: '#e8c21a', csdp: '#b07aa1', cyp: '#8c564b', nnc: '#7b5ea7' }
// 2010-12-25 縣市合併的三個（合併前縣、市各一欄）；新北、桃園是升格，前後同一欄
export const MERGED = ['臺中市', '臺南市', '高雄市']
export const MERGE_DAY = '2010-12-25'

// 日期 → 年（小數，算到日：1990-07-02 ≈ 1990.5）；編年表的位置、高度用
export function yr(d) {
  const [y, m, dd] = d.split('-').map(Number)
  return y + (Date.UTC(y, m - 1, dd) - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1))
}
// 日期的寫法：年份省掉 19／20，寫成 ’51.02.01（只有年就是 ’51）；1900 年以前的照寫四位數（1887.10.31），不然分不出世紀；現任寫「現任」
export const ymd = (d, asOf) => (d === asOf ? '現任' : (/^(19|20)/.test(d) ? `’${d.slice(2)}` : d).replaceAll('-', '.'))

// 黨籍不詳（官派、縣轄市時期有些表沒寫黨籍）
export const UNKNOWN = '#6b6b6b'
export const colorOf = (t) => COLOR[t.party] ?? UNKNOWN
// 格子上名字旁邊的註記：非民選（官派、戰地政務）、代理、補選
export const tagsOf = (t) => [t.note, t.acting && '代理', t.by && '補選'].filter(Boolean)
// 同一人連任才合成一格：民選／官派、代理、補選要一樣（高玉樹 1964 民選、1967 改官派要分開；補選那一任自己一格）
export const sameRun = (a, b) => a.name === b.name && a.end === b.start && a.note === b.note && !!a.acting === !!b.acting && !!a.by === !!b.by && b.start !== MERGE_DAY
