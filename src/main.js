import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index.js';
import store from './store';

// Vue 3 Buefy
import Buefy from 'buefy'
import 'buefy/dist/css/buefy.css'

// Element Plus
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

// fontawesome
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faInfoCircle, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
library.add(faInfoCircle)
library.add(faCheckCircle)

import { initWalletEvents } from '@/utils/walletManager';
initWalletEvents();


import './assets/main.css'
import './assets/font/font.css';

const app = createApp(App);

app.use(store);
app.use(router);
app.use(ElementPlus);
app.use(Buefy);
app.component('font-awesome-icon', FontAwesomeIcon)

app.mount('#app');
