<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div class="mb-4 d-flex flex-wrap align-center justify-space-between gap-3">
      <div>
        <h1 class="text-h4 text-md-h3 text-primary-high font-weight-bold mb-1">Autodarts</h1>
        <p class="text-body-2 text-secondary">Install, update, and control the Autodarts service</p>
      </div>
      <v-btn prepend-icon="mdi-arrow-left" variant="text" @click="router.push('/apps')">Back to Apps</v-btn>
    </div>

    <v-alert
      v-if="status && !status.manager_available"
      class="mb-6"
      icon="mdi-alert"
      prominent
      type="warning"
      variant="tonal"
    >
      <div class="text-h6 mb-2">Autodarts Not Installed</div>
      <div class="text-body-2">Install Autodarts to finish setup.</div>
    </v-alert>

    <div v-if="loading && !status" class="text-center py-16">
      <v-progress-circular color="primary" indeterminate size="64" />
      <div class="text-body-1 text-secondary mt-4">Loading Autodarts status...</div>
    </div>

    <div v-else>
      <v-row>
        <v-col cols="12" lg="6">
          <glass-card class="mb-4" elevated>
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-4">
                <div>
                  <div class="text-caption text-secondary mb-2">Service Status</div>
                  <status-badge :variant="status?.installed ? getStatusVariant() : 'neutral'">
                    {{ getStatusText() }}
                  </status-badge>
                </div>
                <v-icon color="primary" icon="mdi-bullseye-arrow" size="56" style="opacity: 0.3" />
              </div>

              <v-divider class="my-4" style="opacity: 0.1" />

              <div v-if="status?.installed">
                <div class="d-flex justify-space-between align-center mb-3">
                  <span class="text-body-2 text-secondary">Installed Version:</span>
                  <span class="text-h6 text-primary-high font-weight-bold">v{{ status.version }}</span>
                </div>

                <div class="d-flex justify-space-between align-center mb-3">
                  <span class="text-body-2 text-secondary">Latest Version:</span>
                  <span class="text-body-2 text-primary-medium">v{{ status.latest_version }}</span>
                </div>

                <div class="d-flex justify-space-between align-center">
                  <span class="text-body-2 text-secondary">Autostart Enabled:</span>
                  <v-icon :color="status.enabled ? 'success' : 'secondary'" :icon="status.enabled ? 'mdi-check-circle' : 'mdi-close-circle'" size="20" />
                </div>
              </div>

              <div v-else class="text-center py-6">
                <v-icon color="secondary" icon="mdi-package-variant" size="64" style="opacity: 0.3" />
                <div class="text-body-2 text-secondary mt-3">Autodarts is not installed</div>
              </div>
            </v-card-text>
          </glass-card>

          <glass-card v-if="status?.installed" class="mb-4">
            <v-card-title class="text-primary-high">Board Manager</v-card-title>
            <v-card-text>
              <v-btn
                block
                color="primary"
                :href="boardManagerUrl"
                prepend-icon="mdi-open-in-new"
                rel="noopener"
                size="large"
                target="_blank"
              >Open Board Manager</v-btn>
              <div class="text-caption text-secondary mt-2">
                {{ boardManagerUrl }}
              </div>
              <div v-if="boardManagerFallbackUrl" class="text-caption text-secondary mt-1">
                If that does not open, try
                <a :href="boardManagerFallbackUrl" rel="noopener" target="_blank">{{ boardManagerFallbackUrl }}</a>
              </div>
            </v-card-text>
          </glass-card>

          <glass-card>
            <v-card-title class="text-primary-high">{{ status?.installed ? 'Update Autodarts' : 'Install Autodarts' }}</v-card-title>
            <v-card-text>
              <div v-if="!status?.installed">
                <v-text-field
                  v-model="installVersion"
                  class="mb-4"
                  density="comfortable"
                  hint="e.g., 0.20.0"
                  label="Version (leave empty for latest)"
                  persistent-hint
                  variant="outlined"
                />
                <v-checkbox
                  v-model="enableAutostart"
                  class="mb-4"
                  color="primary"
                  hide-details
                  label="Enable autostart"
                />
                <v-btn
                  block
                  color="primary"
                  :disabled="actionLoading !== null"
                  :loading="actionLoading === 'install'"
                  prepend-icon="mdi-download"
                  size="large"
                  @click="handleInstall"
                >
                  Install Autodarts
                </v-btn>
              </div>

              <div v-else>
                <div v-if="status.update_available" class="mb-4">
                  <v-alert icon="mdi-arrow-up-circle" prominent type="info" variant="tonal">
                    <div class="text-body-1 font-weight-medium mb-1">Update Available</div>
                    <div class="text-body-2">A new version (v{{ status.latest_version }}) is available.</div>
                  </v-alert>

                  <v-btn
                    block
                    color="primary"
                    :disabled="actionLoading !== null"
                    :loading="actionLoading === 'update'"
                    prepend-icon="mdi-arrow-up-circle"
                    size="large"
                    @click="handleUpdate"
                  >
                    Update to v{{ status.latest_version }}
                  </v-btn>
                </div>

                <div v-else class="text-center py-6">
                  <v-icon color="success" icon="mdi-check-circle" size="64" style="opacity: 0.3" />
                  <div class="text-body-1 text-success font-weight-medium mt-3">Up to Date</div>
                  <div class="text-caption text-secondary">You have the latest version installed</div>
                </div>

                <v-btn
                  block
                  class="mt-3"
                  color="primary"
                  :loading="checkingUpdate"
                  prepend-icon="mdi-refresh"
                  variant="outlined"
                  @click="handleCheckUpdate"
                >Check for Updates</v-btn>
              </div>
            </v-card-text>
          </glass-card>
        </v-col>

        <v-col cols="12" lg="6">
          <glass-card class="logs-card">
            <v-card-title class="d-flex justify-space-between align-center">
              <span class="text-primary-high">Service Logs</span>
              <div class="d-flex gap-2">
                <v-select
                  v-model="logLines"
                  density="compact"
                  hide-details
                  :items="[10, 25, 50, 100, 200, 500]"
                  style="max-width: 100px"
                  variant="outlined"
                />
                <v-btn
                  icon="mdi-refresh"
                  :loading="logsLoading"
                  size="small"
                  variant="text"
                  @click="fetchLogs"
                />
              </div>
            </v-card-title>
            <v-card-text>
              <div v-if="logsLoading && !logs" class="text-center py-8"><v-progress-circular color="primary" indeterminate size="48" /></div>
              <div v-else-if="logs" class="logs-container"><pre class="logs-content">{{ logs }}</pre></div>
              <div v-else class="text-center py-8">
                <v-icon color="secondary" icon="mdi-text-box-outline" size="48" style="opacity: 0.3" />
                <div class="text-caption text-secondary mt-2">No logs available</div>
              </div>
            </v-card-text>
          </glass-card>
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import GlassCard from '@/components/GlassCard.vue'
  import StatusBadge from '@/components/StatusBadge.vue'
  import { useToast } from '@/composables/useToast'
  import {
    checkAutodartsUpdate,
    getAutodartsLogs,
    getAutodartsStatus,
    getSystemStatus,
    installAutodarts,
    updateAutodarts,
  } from '@/services/api'

  const router = useRouter()
  const { success, error: showError } = useToast()

  const loading = ref(false)
  const status = ref(null)
  const actionLoading = ref(null)
  const checkingUpdate = ref(false)
  const logsLoading = ref(false)
  const logs = ref('')
  const logLines = ref(100)
  const installVersion = ref('')
  const enableAutostart = ref(true)
  const deviceIp = ref('')
  const boardManagerState = ref(null)
  let boardManagerIntervalId = null

  function getStatusText () {
    if (!status.value?.installed) return 'Not Installed'
    const boardState = normalizeState(boardManagerState.value?.status || boardManagerState.value?.event)
    if (boardState) return boardState
    if (boardManagerState.value?.connected) {
      return boardManagerState.value?.running ? 'Running' : 'Stopped'
    }
    if (status.value?.active) return 'Running'
    return 'Stopped'
  }

  function getStatusVariant () {
    const label = getStatusText().toLowerCase()
    if (label === 'running') return 'success'
    if (label === 'starting') return 'info'
    if (label === 'calibrating') return 'warning'
    return 'neutral'
  }

  function normalizeState (value) {
    const raw = String(value || '').toLowerCase()
    if (!raw) return ''
    if (raw.includes('start')) return 'Starting'
    if (raw.includes('calibrat')) return 'Calibrating'
    if (raw.includes('run')) return 'Running'
    if (raw.includes('stop')) return 'Stopped'
    return ''
  }

  function isAutodartsUnavailableError (error) {
    const message = String(error?.message || '').toLowerCase()
    return error?.status === 404
      || error?.status === 502
      || error?.status === 503
      || message.includes('not running')
      || message.includes('not installed')
      || message.includes('not found')
  }

  async function fetchStatus () {
    try {
      loading.value = true
      const response = await getAutodartsStatus()
      status.value = response.data
      syncBoardManagerPolling()
    } catch (error) {
      if (isAutodartsUnavailableError(error)) {
        status.value = { installed: false, active: false, manager_available: false }
        stopBoardManagerPolling()
        return
      }
      showError('Failed to fetch Autodarts status: ' + error.message)
    } finally {
      loading.value = false
    }
  }


  async function fetchLogs () {
    try {
      logsLoading.value = true
      const response = await getAutodartsLogs(logLines.value)
      logs.value = response.data?.logs || 'No logs available'
    } catch (error) {
      showError('Failed to fetch logs: ' + error.message)
      logs.value = 'Failed to load logs'
    } finally {
      logsLoading.value = false
    }
  }

  function buildBoardManagerUrl (host) {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
    const statePath = import.meta.env.VITE_BOARD_MANAGER_STATE_PATH || '/api/state'
    const normalizedPath = statePath.startsWith('/') ? statePath : `/${statePath}`
    return `${protocol}://${host}:3180${normalizedPath}`
  }

  async function fetchBoardManagerState () {
    const host = import.meta.env.VITE_BOARD_MANAGER_HOST || (import.meta.env.DEV ? 'cdo-vertex.local' : 'localhost')
    const url = buildBoardManagerUrl(host)
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error('Board Manager request failed')
      boardManagerState.value = await response.json()
    } catch {
      boardManagerState.value = null
    }
  }

  function startBoardManagerPolling () {
    if (boardManagerIntervalId) return
    fetchBoardManagerState()
    boardManagerIntervalId = setInterval(fetchBoardManagerState, 1000)
  }

  function stopBoardManagerPolling () {
    if (boardManagerIntervalId) {
      clearInterval(boardManagerIntervalId)
      boardManagerIntervalId = null
    }
  }

  function syncBoardManagerPolling () {
    if (status.value?.installed) startBoardManagerPolling()
    else stopBoardManagerPolling()
  }


  const boardManagerUrl = computed(() => {
    const preferredHost = 'cdo-vertex.local'
    return `http://${preferredHost}:3180`
  })

  const boardManagerFallbackUrl = computed(() => {
    if (!deviceIp.value) return ''
    return `http://${deviceIp.value}:3180`
  })

  function pickDeviceIp (network) {
    const interfaces = network?.interfaces || {}
    const candidates = Object.entries(interfaces)
      .filter(([name]) => !name.toLowerCase().includes('lo'))
      .sort(([a], [b]) => {
        const score = name => (name.includes('wlan') ? 0 : name.includes('eth') ? 1 : 2)
        return score(a.toLowerCase()) - score(b.toLowerCase())
      })

    for (const [, iface] of candidates) {
      const addresses = Array.isArray(iface?.addresses) ? iface.addresses : []
      const ipv4 = addresses.find(addr => (addr.type || '').toLowerCase() === 'ipv4')
      if (ipv4?.address) return ipv4.address
    }
    return ''
  }

  async function fetchDeviceIp () {
    try {
      const response = await getSystemStatus()
      deviceIp.value = pickDeviceIp(response.data?.network)
    } catch {
      deviceIp.value = ''
    }
  }

  async function handleInstall () {
    try {
      actionLoading.value = 'install'
      const data = { enable_autostart: enableAutostart.value }
      if (installVersion.value) data.version = installVersion.value
      await installAutodarts(data)
      success('Autodarts installed successfully')
      await fetchStatus()
      await fetchLogs()
      syncBoardManagerPolling()
    } catch (error) {
      showError('Failed to install Autodarts: ' + error.message)
    } finally {
      actionLoading.value = null
    }
  }

  async function handleUpdate () {
    try {
      actionLoading.value = 'update'
      await updateAutodarts()
      success('Autodarts updated successfully')
      await fetchStatus()
      await fetchLogs()
      syncBoardManagerPolling()
    } catch (error) {
      showError('Failed to update Autodarts: ' + error.message)
    } finally {
      actionLoading.value = null
    }
  }

  async function handleCheckUpdate () {
    try {
      checkingUpdate.value = true
      const response = await checkAutodartsUpdate()
      await fetchStatus()
      if (response.data?.update_available) success(`Update available: v${response.data.latest_version}`)
      else success('No updates available')
    } catch (error) {
      showError('Failed to check for updates: ' + error.message)
    } finally {
      checkingUpdate.value = false
    }
  }

  watch(logLines, () => {
    if (status.value?.installed) fetchLogs()
  })

  onMounted(async () => {
    await fetchStatus()
    if (status.value?.installed) await fetchLogs()
    await fetchDeviceIp()
    syncBoardManagerPolling()
  })

  onUnmounted(() => {
    stopBoardManagerPolling()
  })
</script>

<style scoped>
.logs-card {
  height: 100%;
  min-height: 600px;
  display: flex;
  flex-direction: column;
}

.logs-container {
  background: color-mix(in srgb, var(--app-surface-strong) 80%, transparent);
  border-radius: 8px;
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.logs-content {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-primary);
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
