<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div v-if="isOverviewRoute" class="mb-6">
      <h1 class="text-h4 text-md-h3 text-primary-high font-weight-bold mb-1">Apps</h1>
      <p class="text-body-2 text-secondary">Installed applications and runtime status</p>
    </div>

    <router-view v-if="!isOverviewRoute" />

    <v-row v-else>
      <v-col cols="12" lg="4" md="6">
        <glass-card class="h-100 hoverable-card app-card" @click="router.push('/apps/autodarts')">
          <v-card-text>
            <div class="d-flex justify-space-between align-start mb-4">
              <v-avatar color="primary" size="48" variant="tonal">
                <v-icon icon="mdi-bullseye-arrow" />
              </v-avatar>
              <status-badge :variant="autodartsBadgeVariant">
                {{ autodartsBadgeText }}
              </status-badge>
            </div>
            <div class="text-h6 text-primary-high font-weight-bold">Autodarts</div>
            <div class="text-body-2 text-secondary mt-1">
              {{ autodartsStatus?.installed ? `Version ${autodartsStatus?.version || 'n/a'}` : 'Install to enable smart dartboard scoring.' }}
            </div>
            <v-chip
              class="mt-4"
              color="info"
              prepend-icon="mdi-cog"
              size="small"
              variant="tonal"
            >
              Tap for controls
            </v-chip>
          </v-card-text>
        </glass-card>
      </v-col>

      <v-col cols="12" lg="4" md="6">
        <glass-card class="h-100">
          <v-card-text>
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="text-h6 text-primary-high">Future App Slots</div>
              <v-icon color="secondary" icon="mdi-download-circle-outline" />
            </div>
            <div class="text-body-2 text-secondary mb-3">
              This area is ready for downloadable apps in upcoming releases.
            </div>
            <v-chip color="secondary" size="small" variant="outlined">Coming Soon</v-chip>
          </v-card-text>
        </glass-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import GlassCard from '@/components/GlassCard.vue'
  import StatusBadge from '@/components/StatusBadge.vue'
  import { useToast } from '@/composables/useToast'
  import { getAutodartsStatus } from '@/services/api'

  const route = useRoute()
  const router = useRouter()
  const { error: showError } = useToast()

  const loading = ref(false)
  const autodartsStatus = ref(null)
  const boardManagerState = ref(null)
  let boardManagerIntervalId = null
  let appsStatusIntervalId = null
  const wsConnected = ref(false)

  const isOverviewRoute = computed(() => route.path === '/apps')

  const autodartsBadgeText = computed(() => {
    if (!autodartsStatus.value?.installed) return 'Not Installed'
    const boardState = normalizeState(boardManagerState.value?.status || boardManagerState.value?.event)
    if (boardState) return boardState
    if (boardManagerState.value?.connected) {
      return boardManagerState.value?.running ? 'Running' : 'Stopped'
    }
    const rawStatus = String(autodartsStatus.value?.status || '')
    const apiState = normalizeState(rawStatus)
    if (apiState) return apiState
    return autodartsStatus.value?.active ? 'Running' : 'Stopped'
  })

  const autodartsBadgeVariant = computed(() => {
    const status = autodartsBadgeText.value.toLowerCase()
    if (status === 'running') return 'success'
    if (status === 'starting') return 'info'
    if (status === 'calibrating') return 'warning'
    return 'neutral'
  })

  function isAutodartsUnavailableError (error) {
    const message = String(error?.message || '').toLowerCase()
    return error?.status === 404
      || error?.status === 502
      || error?.status === 503
      || message.includes('not running')
      || message.includes('not installed')
      || message.includes('not found')
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

  async function fetchAppsStatus () {
    try {
      const response = await getAutodartsStatus()
      autodartsStatus.value = response.data
      return !!autodartsStatus.value?.installed
    } catch (error) {
      if (isAutodartsUnavailableError(error)) {
        autodartsStatus.value = { installed: false, active: false }
        stopAppsStatusPolling()
        stopBoardManagerPolling()
        return false
      }
      showError('Failed to load app status: ' + error.message)
      return false
    }
  }

  async function startAppsStatusPolling () {
    if (appsStatusIntervalId) return
    const isInstalled = await fetchAppsStatus()
    if (!isInstalled) {
      stopBoardManagerPolling()
      return
    }
    startBoardManagerPolling()
    appsStatusIntervalId = setInterval(fetchAppsStatus, 1000)
  }

  function stopAppsStatusPolling () {
    if (appsStatusIntervalId) {
      clearInterval(appsStatusIntervalId)
      appsStatusIntervalId = null
    }
  }

  watch(() => route.path, async newPath => {
    if (newPath === '/apps') {
      await startAppsStatusPolling()
    } else {
      stopAppsStatusPolling()
      stopBoardManagerPolling()
    }
  })

  onMounted(async () => {
    if (isOverviewRoute.value) {
      await startAppsStatusPolling()
    }
  })

  onUnmounted(() => {
    stopAppsStatusPolling()
    stopBoardManagerPolling()
  })
</script>

<style scoped>
.app-card {
  cursor: pointer;
}
</style>
