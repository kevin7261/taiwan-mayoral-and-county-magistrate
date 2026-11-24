import { createApp } from 'vue'
import App from './App.vue'
import 'bootstrap/dist/css/bootstrap.min.css' // 介面元件（按鈕、開關、滑桿）用 Bootstrap
import './style.css'
import './cjkExtra.css' // Noto Sans TC 沒有的字用 Noto Sans CJK TC 補

createApp(App).mount('#app')
