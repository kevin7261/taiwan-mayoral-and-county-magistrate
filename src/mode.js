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

// 時間的方向（編年表、地圖的時間軸共用）：true＝近到遠（現在在上面，預設）、false＝遠到近（最早的在上面）
export const REV_DEFAULT = true
export const rev = ref(REV_DEFAULT)
export const ORDERS = [[true, '近到遠', '時間由上往下：現在在最上面（預設）'], [false, '遠到近', '時間由上往下：最早的在最上面']]
