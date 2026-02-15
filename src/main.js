/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue'
import { getHealth } from '@/services/api'

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Styles
import 'unfonts.css'
import '@/styles/global.scss'

const app = createApp(App)

registerPlugins(app)

app.mount('#app')

async function runHealthCheck () {
	try {
		await getHealth()
		console.info('API health check OK')
	} catch (error) {
		console.warn('API health check failed', error)
	}
}

runHealthCheck()
