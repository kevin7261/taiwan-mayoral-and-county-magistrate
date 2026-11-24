// 現在看哪個分頁（編年表／地圖）：記在網址的 #（#map＝地圖），重新整理、貼連結都會開在同一頁
import { ref } from 'vue'

export const TABS = [['chrono', '編年表'], ['map', '地圖']]
const fromHash = () => (location.hash === '#map' ? 'map' : 'chrono')
export const mode = ref(fromHash())
export function setMode(k) {
  mode.value = k
  history.replaceState(null, '', k === 'map' ? '#map' : location.pathname + location.search)
}
window.addEventListener('hashchange', () => (mode.value = fromHash()))
