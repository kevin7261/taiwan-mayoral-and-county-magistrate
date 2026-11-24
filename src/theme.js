// 日／夜模式：記在 localStorage；沒選過就跟著系統（prefers-color-scheme）。
// 寫在 <html data-bs-theme>（Bootstrap 也看這個）；index.html 開頭先設好，載入時不會閃一下
import { ref, watch } from 'vue'

const KEY = 'theme'
const sys = matchMedia('(prefers-color-scheme: light)')
const saved = () => localStorage.getItem(KEY)
export const theme = ref(saved() || (sys.matches ? 'light' : 'dark'))
watch(theme, (t) => (document.documentElement.dataset.bsTheme = t), { immediate: true })
sys.addEventListener('change', (e) => saved() || (theme.value = e.matches ? 'light' : 'dark'))
export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(KEY, theme.value)
}

// JS 裡要用到的顏色（要是 #rrggbb：編年表會在後面接透明度）
const C = {
  dark: { plain: '#48484a', vacant: '#232325' },
  light: { plain: '#8e8e93', vacant: '#e5e5ea' },
}
export const plain = () => C[theme.value].plain // 不顯示政黨色時格子、縣市的顏色
export const vacant = () => C[theme.value].vacant // 地圖：那一天沒有首長
