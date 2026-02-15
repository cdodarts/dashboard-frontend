<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-3">
      <div>
        <h1 class="text-h4 text-md-h3 text-primary-high font-weight-bold mb-1">Dashboard</h1>
        <p class="text-body-2 text-secondary">At-a-glance device health</p>
      </div>
      <connection-status :connected="isConnected" />
    </div>

    <div v-if="loading && !systemData" class="text-center py-16">
      <v-progress-circular color="primary" indeterminate size="64" />
      <div class="text-body-1 text-secondary mt-4">Loading dashboard...</div>
    </div>

    <v-alert
      v-else-if="error"
      class="mb-6"
      icon="mdi-alert-circle"
      prominent
      type="error"
      variant="tonal"
    >
      <div class="text-h6 mb-2">Connection Error</div>
      <div class="text-body-2">{{ error }}</div>
      <div v-if="errorDetails.length" class="text-caption text-secondary mt-2">
        <div v-for="(detail, index) in errorDetails" :key="index">{{ detail }}</div>
      </div>
      <template #append>
        <v-btn color="error" variant="outlined" @click="fetchData">Retry</v-btn>
      </template>
    </v-alert>

    <div v-else class="d-flex flex-column ga-4">
      <glass-card elevated>
        <v-card-text class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center ga-4">
          <div>
            <div class="text-overline text-secondary">Device summary</div>
            <div class="text-h5 text-primary-high font-weight-bold">{{ systemData?.hostname?.hostname || 'CDO Vertex' }}</div>
            <div class="text-body-2 text-secondary">
              Uptime {{ formatUptime(systemData?.uptime?.uptime_seconds || 0) }} · API {{ apiVersion || 'n/a' }} · Dashboard v{{ dashboardVersion }}
            </div>
          </div>
          <div class="d-flex ga-2 flex-wrap">
            <v-chip :color="usageColor(cpuUsedPercent)" prepend-icon="mdi-chip" variant="tonal">{{ cpuUsedPercent }}% CPU</v-chip>
            <v-chip :color="memoryUsageColor(memoryUsedPercent)" prepend-icon="mdi-memory" variant="tonal">{{ memoryUsedPercent }}% Memory</v-chip>
            <v-chip :color="usageColor(diskUsedPercent)" prepend-icon="mdi-harddisk" variant="tonal">{{ diskUsedPercent }}% Disk</v-chip>
            <v-chip :color="temperatureStatus.color" prepend-icon="mdi-thermometer" variant="tonal">{{ currentTemp.toFixed(1) }}°C</v-chip>
          </div>
        </v-card-text>
      </glass-card>

      <v-row>
        <v-col cols="12" lg="12" md="12">
          <glass-card class="h-100 hoverable-card">
            <v-card-title class="text-primary-high">Temperature</v-card-title>
            <v-card-text>
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-body-2 text-secondary">CPU Temperature</span>
                <span class="text-h5" :class="`text-${temperatureStatus.color}`">{{ currentTemp.toFixed(1) }}°C</span>
              </div>
              <v-progress-linear :color="temperatureStatus.color" height="12" :model-value="Math.min(Math.max(currentTemp, 0), 100)" rounded />
              <v-alert class="mt-3" density="comfortable" :type="temperatureStatus.alertType" variant="tonal">
                {{ temperatureStatus.message }}
              </v-alert>
            </v-card-text>
          </glass-card>
        </v-col>
      </v-row>

      <div class="text-center mt-2">
        <div class="text-caption text-secondary">Last updated: {{ lastUpdated }}</div>
      </div>
    </div>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import ConnectionStatus from '@/components/ConnectionStatus.vue'
  import GlassCard from '@/components/GlassCard.vue'
  import { useToast } from '@/composables/useToast'
  import { getHealth, getSystemStatus } from '@/services/api'
  import packageJson from '../../package.json'

  const { error: showError } = useToast()

  const dashboardVersion = packageJson.version

  const loading = ref(false)
  const error = ref(null)
  const isConnected = ref(true)
  const systemData = ref(null)
  const apiVersion = ref('')
  const lastUpdated = ref('')
  const rawError = ref(null)
  let intervalId = null
  const errorDetails = computed(() => {
    if (!rawError.value) return []
    const details = []
    if (rawError.value.code) details.push(`Code: ${rawError.value.code}`)
    if (rawError.value.status) details.push(`Status: ${rawError.value.status}`)
    if (rawError.value.requestUrl) details.push(`URL: ${rawError.value.requestUrl}`)
    return details
  })


  const TEMP_NORMAL_MAX = 60
  const TEMP_MODERATE_MAX = 70
  const TEMP_HIGH_MAX = 80

  const cpuUsedPercent = computed(() => Math.round(Number(
    systemData.value?.cpu?.usage_percent ?? systemData.value?.cpu?.usage ?? 0,
  )))
  const memoryUsedPercent = computed(() => Math.round(Number(
    systemData.value?.memory?.percent ?? systemData.value?.memory?.percent_used ?? 0,
  )))
  const diskUsedPercent = computed(() => Math.round(Number(
    systemData.value?.disk?.percent ?? systemData.value?.disk?.percent_used ?? 0,
  )))
  const currentTemp = computed(() => Number(
    systemData.value?.temperature?.celsius ?? systemData.value?.temperature?.temp_c ?? 0,
  ))

  const temperatureStatus = computed(() => {
    if (currentTemp.value >= TEMP_HIGH_MAX) {
      return {
        color: 'error',
        alertType: 'error',
        message: 'Your CDO Vertex is running hot. Temperature is in the critical range; the system may throttle to prevent damage.',
      }
    }
    if (currentTemp.value >= TEMP_MODERATE_MAX) {
      return {
        color: 'warning',
        alertType: 'warning',
        message: 'Your CDO Vertex is above the ideal 70°C. Ensure it is not in direct sunlight and the vent has room for airflow.',
      }
    }
    if (currentTemp.value >= TEMP_NORMAL_MAX) {
      return {
        color: 'info',
        alertType: 'info',
        message: 'Your CDO Vertex is operating in normal temperatures under typical use.',
      }
    }
    return {
      color: 'success',
      alertType: 'success',
      message: 'Your CDO Vertex is operating in normal temperatures.',
    }
  })

  function usageColor (value) {
    if (value >= 90) return 'error'
    if (value >= 70) return 'warning'
    return 'success'
  }

  function memoryUsageColor (value) {
    if (value >= 95) return 'error'
    if (value >= 85) return 'warning'
    return 'success'
  }

  function formatUptime (seconds) {
    const total = Number(seconds || 0)
    const days = Math.floor(total / 86_400)
    const hours = Math.floor((total % 86_400) / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  async function fetchData () {
    try {
      loading.value = true
      error.value = null
      const response = await getSystemStatus()
      systemData.value = response.data
      isConnected.value = true
      lastUpdated.value = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    } catch (error_) {
      error.value = error_.message
      rawError.value = error_
      isConnected.value = false
      showError('Failed to fetch dashboard data: ' + error_.message)
    } finally {
      loading.value = false
    }
  }

  async function fetchHealth () {
    try {
      const response = await getHealth()
      apiVersion.value = response.data?.version || ''
    } catch {
      apiVersion.value = ''
    }
  }

  onMounted(async () => {
    await fetchHealth()
    await fetchData()
    intervalId = setInterval(fetchData, 5000)
  })

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId)
  })
</script>
