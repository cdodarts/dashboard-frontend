<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-3">
      <div>
        <h1 class="text-h4 text-md-h3 text-primary-high font-weight-bold mb-1">Dashboard</h1>
        <p class="text-body-2 text-secondary">At-a-glance device health</p>
      </div>
      <connection-status :connected="isConnected" />
    </div>

    <v-alert
      v-if="updateData?.components?.length"
      class="mb-4"
      color="warning"
      icon="mdi-update"
      type="warning"
      variant="tonal"
    >
      <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center ga-3">
        <div>
          <div class="text-subtitle-1 font-weight-bold">Update available</div>
          <div class="text-body-2">
            {{ updateSummary }}
          </div>
        </div>
        <v-btn
          color="warning"
          :disabled="applyingUpdate"
          :loading="applyingUpdate"
          prepend-icon="mdi-download"
          @click="handleApplyUpdate"
        >Update now</v-btn>
      </div>
    </v-alert>

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
      <div v-if="errorDetails.length > 0" class="text-caption text-secondary mt-2">
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
              Uptime {{ formatUptime(systemData?.uptime?.uptime_seconds || 0) }} · Dashboard v{{ dashboardVersion }}
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

    <v-dialog v-model="showUpdateDialog" persistent max-width="460">
      <v-card class="dialog">
        <v-card-text class="dialog__body">
          <v-progress-circular indeterminate size="56" width="5" color="primary" />
          <div>
            <h3>Updating device</h3>
            <p>{{ updateStatusText }}</p>
            <p v-if="updateJobId" class="text-caption">Job {{ updateJobId }}</p>
            <p v-if="updateLogPath" class="text-caption">Log: {{ updateLogPath }}</p>
            <p v-if="updateFailed" class="text-caption text-error">{{ updateError }}</p>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import ConnectionStatus from '@/components/ConnectionStatus.vue'
  import GlassCard from '@/components/GlassCard.vue'
  import { useToast } from '@/composables/useToast'
  import { applyUpdates, getSystemStatus, getUpdates, getUpdateStatus } from '@/services/api'
  import packageJson from '../../package.json'

  const { success, error: showError } = useToast()

  const dashboardVersion = packageJson.version

  const loading = ref(false)
  const error = ref(null)
  const isConnected = ref(true)
  const systemData = ref(null)
  const lastUpdated = ref('')
  const rawError = ref(null)
  const updateData = ref(null)
  const applyingUpdate = ref(false)
  const showUpdateDialog = ref(false)
  const updateStatusText = ref('Starting update...')
  const updateJobId = ref(null)
  const updateLogPath = ref('')
  const updateFailed = ref(false)
  const updateError = ref('')
  let intervalId = null
  let updatePollTimer = null
  const UPDATE_POLL_MS = 3000
  const errorDetails = computed(() => {
    if (!rawError.value) return []
    const details = []
    if (rawError.value.code) details.push(`Code: ${rawError.value.code}`)
    if (rawError.value.status) details.push(`Status: ${rawError.value.status}`)
    if (rawError.value.requestUrl) details.push(`URL: ${rawError.value.requestUrl}`)
    return details
  })

  const updateSummary = computed(() => {
    const firstComponent = updateData.value?.components?.[0]
    if (!firstComponent) return 'A system update is available.'
    return `${firstComponent.name}: ${firstComponent.current_version} → ${firstComponent.latest_version}`
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

  async function fetchUpdates () {
    try {
      const response = await getUpdates()
      const components = response.data?.components || []
      updateData.value = components.some(component => component.update_available) ? response.data : null
    } catch {
      updateData.value = null
    }
  }

  async function handleApplyUpdate () {
    try {
      applyingUpdate.value = true
      const response = await applyUpdates()
      const result = response.data || {}
      if (result.started || result.success) {
        updateJobId.value = result.job_id || null
        updateLogPath.value = result.log_path || ''
        updateStatusText.value = 'Applying update. Please keep this page open.'
        updateFailed.value = false
        updateError.value = ''
        showUpdateDialog.value = true
        if (updateJobId.value) {
          await pollUpdateStatus(updateJobId.value)
        }
        success('Update started. The device will restart when finished.')
      } else {
        showError(result.error || 'Update command failed to start.')
      }
      await fetchUpdates()
    } catch (error_) {
      showError('Failed to apply update: ' + error_.message)
    } finally {
      applyingUpdate.value = false
    }
  }

  onMounted(async () => {
    await fetchData()
    await fetchUpdates()
    intervalId = setInterval(() => {
      fetchData()
      fetchUpdates()
    }, 5000)
  })

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId)
    if (updatePollTimer) clearTimeout(updatePollTimer)
  })

  async function pollUpdateStatus (jobId) {
    if (!jobId) return

    const poll = async () => {
      try {
        const response = await getUpdateStatus(jobId)
        const status = response.data || {}
        updateStatusText.value = status.running ? 'Installing update...' : 'Finalizing update...'
        if (status.finished) {
          if (status.success === false || status.error) {
            updateFailed.value = true
            updateError.value = status.error || 'Update failed. Check the log for details.'
            return
          }
          showUpdateDialog.value = false
          window.location.reload()
          return
        }
      } catch {
        updateStatusText.value = 'Waiting for the device to respond...'
      }

      updatePollTimer = setTimeout(poll, UPDATE_POLL_MS)
    }

    if (updatePollTimer) clearTimeout(updatePollTimer)
    updatePollTimer = setTimeout(poll, 0)
  }
</script>

<style scoped>
.dialog {
  border-radius: 18px;
  background: #121620;
  color: rgba(246, 247, 249, 0.98);
}

.dialog__body {
  display: flex;
  gap: 16px;
  align-items: center;
}
</style>
