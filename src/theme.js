// 日／夜模式：預設看現在幾點（使用者那邊的時間，06:00–18:00 日間、其他夜間），開著的時候到點會自動換；
// 使用者自己按過切換鈕之後才記在 localStorage，之後就固定用那個。
// 寫在 <html data-bs-theme>（Bootstrap 也看這個）；index.html 開頭先設好（同一套規則），載入時不會閃一下
import { ref, watch } from 'vue'

const KEY = 'theme'
const saved = () => { try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : null } catch { return null } }
const byClock = () => { const h = new Date().getHours(); return h >= 6 && h < 18 ? 'light' : 'dark' }
export const theme = ref(saved() ?? byClock())
watch(theme, (t) => (document.documentElement.dataset.bsTheme = t), { immediate: true })
// 沒有自己選過：每分鐘看一次時間，跨過 06:00、18:00 就換
setInterval(() => saved() ?? (theme.value = byClock()), 60_000)
export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem(KEY, theme.value) } catch { /* 不能存（無痕模式等）：這次照樣切，下次回到看時間 */ }
}

// JS 裡要用到的顏色（要是 #rrggbb：編年表會在後面接透明度）
const C = {
  dark: { plain: '#48484a', vacant: '#232325' },
  light: { plain: '#8e8e93', vacant: '#e5e5ea' },
}
export const plain = () => C[theme.value].plain // 不顯示政黨色時格子、縣市的顏色
export const vacant = () => C[theme.value].vacant // 地圖：那一天沒有首長
