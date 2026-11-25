<template>
  <!-- 工具列（像 Google 試算表）：一條膠囊，裡面的幾組按鈕由左排到右；畫面不夠寬、放不下的那幾組收進最右邊的「⋮ 更多」，
       按了從下面掉出一個選單。寬度一變就重排。
       做法：放不下的那幾組整個搬到選單裡（搬的是同一批 DOM，按鈕的狀態、事件都還在），放得下了再搬回來 -->
  <div ref="bar" class="toolbar">
    <div ref="ctl" class="ctl" role="toolbar" aria-label="工具列">
      <slot />
      <button v-show="hidden" ref="more" type="button" class="btn btn-sm btn-tb more" :class="{ active: open }" :aria-expanded="open" aria-haspopup="true" title="更多" aria-label="更多" @click.stop="open = !open">
        <span class="material-symbols-outlined">more_vert</span>
      </button>
    </div>
    <div v-show="open && hidden" ref="pop" class="more-pop kcard" role="group" aria-label="更多" @click.stop></div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const bar = ref(null), ctl = ref(null), more = ref(null), pop = ref(null)
const hidden = ref(0) // 收進選單的有幾組
const open = ref(false)
let items = [] // 工具列裡的每一組（照原本的順序）；直線分隔（.vr）不算
let ro, mo, busy = false

function layout() {
  const c = ctl.value
  if (!c || busy || !bar.value.clientWidth) return // 這個分頁藏起來的時候不排
  busy = true
  mo?.disconnect()
  // 先全部搬回工具列（放在「更多」前面），量得到每一組的寬
  for (const el of items) c.insertBefore(el, more.value)
  const cs = getComputedStyle(c), gap = parseFloat(cs.columnGap) || 0
  const room = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const w = items.map((el) => el.getBoundingClientRect().width)
  const total = w.reduce((a, b) => a + b, 0) + gap * (items.length - 1)
  let keep = items.length
  if (total > room + 0.5) {
    // 放不下：留給「更多」的位置，從左邊開始能放幾組放幾組（第一組一定留著）
    const left = room - 32 - gap
    let used = 0
    keep = 0
    for (let i = 0; i < items.length; i++) {
      used += w[i] + (i ? gap : 0)
      if (used > left && i > 0) break
      keep = i + 1
    }
  }
  for (const el of items.slice(keep)) pop.value.appendChild(el)
  hidden.value = items.length - keep
  if (!hidden.value) open.value = false
  nextTick(() => { busy = false; watchItems() })
}
// 某一組裡面的字變了（播放／暫停、日期…）寬度會變：重排
function watchItems() {
  mo ??= new MutationObserver(() => layout())
  for (const el of items) mo.observe(el, { childList: true, subtree: true, characterData: true })
}
const close = () => (open.value = false)
const onKey = (e) => e.key === 'Escape' && close()

onMounted(() => {
  items = [...ctl.value.children].filter((el) => el !== more.value && !el.classList.contains('vr'))
  ro = new ResizeObserver(() => layout())
  ro.observe(bar.value)
  document.fonts?.ready.then(layout) // 字型載好後寬度會變
  window.addEventListener('click', close)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  mo?.disconnect()
  window.removeEventListener('click', close)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.toolbar { position: relative; }
.more { margin-left: auto; }
/* 掉下來的選單：貼著工具列右下，裡面一組一行 */
.more-pop { position: absolute; right: 10px; top: calc(100% - 4px); z-index: 30; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: calc(100vw - 20px); padding: 10px; background: var(--tb-bg); -webkit-backdrop-filter: none; backdrop-filter: none; }
/* 選單裡每一組維持一行（跟在工具列上一樣），不要被擠成好幾行 */
.more-pop :deep(> *) { flex: none; }
.more-pop :deep(.tb-grp) { flex-wrap: nowrap; max-width: 100%; }
.more-pop :deep(.form-range) { width: 110px; }
/* 手機版面工具列上只留圖示的按鈕：在選單裡有位置，把字放回來 */
.more-pop :deep(.lbl) { display: inline; }
</style>
