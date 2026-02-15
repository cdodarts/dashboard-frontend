<template>
  <div class="system-status-bar px-4 px-md-6">
    <div class="status-content">
      <div class="d-flex align-center ga-3 text-caption">
        <span class="d-flex align-center ga-1">
          <v-icon :color="connectionStatus.color" :icon="connectionStatus.icon" size="16" />
          <span>{{ connectionLabel }}</span>
        </span>
        <span v-if="showWifiSignal" class="d-flex align-center ga-1" :title="wifiLevel.label">
          <v-icon :color="wifiLevel.color" :icon="wifiLevel.icon" size="16" />
        </span>
      </div>
      <div class="d-flex align-center ga-2 text-caption">
        <v-icon icon="mdi-clock-outline" size="16" />
        <span>{{ timeLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { getSystemStatus } from '@/services/api'

  const wifi = ref(null)
  const network = ref(null)
  const timeLabel = ref('')
  let intervalId = null

  const isWifiConnected = computed(() => {
    if (wifi.value?.connected) return true
    const interfaces = network.value?.interfaces || {}
    return Object.entries(interfaces).some(([name, iface]) => {
      if (!name.toLowerCase().includes('wlan')) return false
      return Array.isArray(iface?.addresses) && iface.addresses.length > 0
    })
  })

  const isEthernetConnected = computed(() => {
    const interfaces = network.value?.interfaces || {}
    return Object.entries(interfaces).some(([name, iface]) => {
      const lowerName = name.toLowerCase()
      if (lowerName.includes('wlan') || lowerName.includes('lo')) return false
      return Array.isArray(iface?.addresses) && iface.addresses.length > 0
    })
  })

  const networkName = computed(() => {
    if (isEthernetConnected.value) return 'Ethernet Online'
    if (isWifiConnected.value) return 'WiFi'
    return 'Offline'
  })

  const signalPercent = computed(() => {
    const raw = wifi.value?.signal_percent ?? wifi.value?.strength
    if (typeof raw === 'number') return Math.max(0, Math.min(100, Math.round(raw)))
    const dbm = wifi.value?.signal_dbm ?? wifi.value?.signal
    if (typeof dbm === 'number') {
      const percent = Math.round(2 * (dbm + 100))
      return Math.max(0, Math.min(100, percent))
    }
    return 0
  })

  const wifiLevel = computed(() => {
    if (!isWifiConnected.value) {
      return { icon: 'mdi-wifi-off', color: 'secondary', label: 'No signal', weak: false }
    }
    const strength = signalPercent.value
    let icon = 'mdi-wifi-strength-1'
    if (strength >= 75) icon = 'mdi-wifi-strength-4'
    else if (strength >= 50) icon = 'mdi-wifi-strength-3'
    else if (strength >= 25) icon = 'mdi-wifi-strength-2'

    let color = 'error'
    let label = 'Weak signal'
    if (strength >= 67) {
      color = 'success'
      label = 'Strong signal'
    } else if (strength >= 34) {
      color = 'warning'
      label = 'Moderate signal'
    }

    return { icon, color, label, weak: strength < 34 }
  })

  const connectionStatus = computed(() => {
    if (isEthernetConnected.value) {
      return { icon: 'mdi-ethernet', color: 'success' }
    }
    if (isWifiConnected.value) {
      return { icon: 'mdi-wifi', color: wifiLevel.value.color }
    }
    return { icon: 'mdi-lan-disconnect', color: 'secondary' }
  })

  const connectionLabel = computed(() => {
    if (isEthernetConnected.value) return 'Online'
    if (isWifiConnected.value) {
      return wifiLevel.value.weak ? `${networkName.value} (weak connection)` : networkName.value
    }
    return 'Offline'
  })

  const showWifiSignal = computed(() => isWifiConnected.value)

  async function refreshStatus () {
    try {
      const response = await getSystemStatus()
      wifi.value = response.data?.wifi || null
      network.value = response.data?.network || null
    } catch {
      wifi.value = null
    }

    timeLabel.value = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  onMounted(async () => {
    await refreshStatus()
    intervalId = setInterval(refreshStatus, 5000)
  })

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId)
  })
</script>

<style scoped>
.system-status-bar {
  position: sticky;
  top: 0;
  z-index: 8;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  background: color-mix(in srgb, var(--app-surface-strong) 82%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--app-border) 85%, transparent);
}

.status-content {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-text-medium);
}
</style>
