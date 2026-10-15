<template>
  <glass-card elevated>
    <v-card-title class="d-flex align-center ga-2 text-primary-high">
      <v-icon icon="mdi-bullseye-arrow" />
      Dart detector
    </v-card-title>
    <v-card-text>
      <p class="text-body-2 text-secondary mb-4">
        Finish your game and remove all darts before switching. Your saved provider starts on boot.
        Only one detector can run at a time.
      </p>

      <v-alert
        v-if="busy"
        class="mb-4"
        density="comfortable"
        type="info"
        variant="tonal"
      >
        <v-progress-circular class="mr-2" indeterminate size="20" width="2" />
        Switching to {{ providerName(pendingProvider) }}. Checking live status…
      </v-alert>
      <v-alert v-else-if="!status && fetching" class="mb-4" type="info" variant="tonal">
        Loading detector status…
      </v-alert>
      <v-alert v-if="error" class="mb-4" type="error" variant="tonal">
        <div>{{ error }}</div>
        <v-btn
          class="mt-2"
          :disabled="busy || fetching"
          size="small"
          variant="outlined"
          @click="refreshStatus"
        >Retry status</v-btn>
      </v-alert>
      <v-alert v-if="status?.active === 'conflict'" class="mb-4" type="warning" variant="tonal">
        Both detectors are running. Choose a provider below to restore a single active detector.
      </v-alert>

      <div aria-live="polite" class="text-body-2 mb-4">
        <template v-if="statusKnown">
          Saved provider: <strong>{{ providerName(status.selected) }}</strong>
          · Live: <strong>{{ liveStatus }}</strong>
        </template>
        <template v-else-if="status">Checking current provider selection and live status…</template>
        <template v-else>Provider selection and live status unavailable.</template>
      </div>

      <v-row>
        <v-col v-for="provider in providers" :key="provider.id" cols="12" md="6">
          <v-card
            class="h-100"
            :color="statusKnown && status.selected === provider.id ? 'primary' : undefined"
            variant="tonal"
          >
            <v-card-text>
              <div class="text-h6 mb-2">{{ provider.name }}</div>
              <div class="d-flex flex-wrap ga-2 mb-4">
                <v-chip size="small">{{ statusKnown ? (provider.installed ? 'Installed' : 'Not installed') : 'Installation unknown' }}</v-chip>
                <v-chip :color="statusKnown && provider.active ? 'success' : undefined" size="small">
                  {{ statusKnown ? (provider.active ? 'Running' : 'Stopped') : 'Live status unknown' }}
                </v-chip>
                <v-chip v-if="statusKnown && status.selected === provider.id" color="primary" size="small">Saved provider</v-chip>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-btn
                  :disabled="busy || !statusKnown || !provider.installed || (status.selected === provider.id && status.active === provider.id)"
                  :loading="busy && pendingProvider === provider.id"
                  @click="selectProvider(provider.id)"
                >{{ statusKnown && status.selected === provider.id ? (status.active === provider.id ? 'Selected' : 'Start / retry') : 'Select' }}</v-btn>
                <v-btn
                  :disabled="busy || !statusKnown || !provider.installed || !provider.active || status.active === 'conflict'"
                  :href="consoleUrl(provider.id)"
                  prepend-icon="mdi-open-in-new"
                  rel="noopener noreferrer"
                  target="_blank"
                  variant="outlined"
                >Open console</v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
  </glass-card>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import GlassCard from '@/components/GlassCard.vue'
  import { getDetectors, switchDetector } from '@/services/api'

  const definitions = [
    { id: 'autodarts', name: 'Autodarts', port: 3180 },
    { id: 'cdo', name: 'CDO Dart Detector', port: 41_975 },
  ]
  const status = ref(null)
  const statusKnown = ref(false)
  const fetching = ref(false)
  const busy = ref(false)
  const error = ref('')
  const pendingProvider = ref(null)
  let timer = null
  let controller = null
  let generation = 0
  let disposed = false

  const providers = computed(() => definitions.map(provider => ({
    ...provider,
    ...status.value?.providers?.find(item => item.id === provider.id),
    name: provider.name,
  })))
  const liveStatus = computed(() => status.value?.active === 'conflict'
    ? 'Both detectors running'
    : (status.value?.active ? providerName(status.value.active) : 'Stopped'))

  function providerName (id) {
    return definitions.find(provider => provider.id === id)?.name || 'Unknown'
  }

  function consoleUrl (id) {
    const url = new URL(window.location.href)
    url.protocol = 'http:'
    url.port = String(definitions.find(provider => provider.id === id).port)
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.href
  }

  function acceptStatus (data) {
    if (!definitions.some(provider => provider.id === data?.selected)
      || ![null, 'autodarts', 'cdo', 'conflict'].includes(data?.active)
      || !Array.isArray(data?.providers)) {
      throw new Error('Detector status could not be confirmed. Retry status before switching.')
    }
    status.value = data
    statusKnown.value = true
  }

  function schedulePoll () {
    clearTimeout(timer)
    if (!disposed && !busy.value) timer = setTimeout(refreshStatus, 5000)
  }

  async function refreshStatus () {
    if (disposed || busy.value || fetching.value) return
    clearTimeout(timer)
    const requestGeneration = generation
    const requestController = new AbortController()
    controller = requestController
    fetching.value = true
    try {
      const response = await getDetectors({ signal: requestController.signal })
      if (disposed || requestGeneration !== generation) return
      acceptStatus(response.data)
      error.value = ''
    } catch (error_) {
      if (disposed || requestGeneration !== generation) return
      statusKnown.value = false
      error.value = error_.message
    } finally {
      if (requestGeneration === generation) {
        fetching.value = false
        controller = null
        schedulePoll()
      }
    }
  }

  async function selectProvider (provider) {
    if (busy.value || !statusKnown.value) return
    clearTimeout(timer)
    generation++
    controller?.abort()
    controller = null
    fetching.value = false
    busy.value = true
    statusKnown.value = false
    pendingProvider.value = provider
    error.value = ''
    try {
      const response = await switchDetector(provider)
      if (disposed) return
      acceptStatus(response.data)
    } catch (error_) {
      if (disposed) return
      error.value = `Could not switch detector: ${error_.message}`
      // A failed or timed-out request may still have changed the service or saved selection.
      // Reconcile with the device instead of showing an optimistic selection.
      try {
        const response = await getDetectors()
        if (disposed) return
        acceptStatus(response.data)
      } catch {
        if (!disposed) error.value += ' Current status is unavailable. Retry status to confirm the selected provider.'
      }
    } finally {
      if (!disposed) {
        busy.value = false
        pendingProvider.value = null
        schedulePoll()
      }
    }
  }

  onMounted(refreshStatus)
  onUnmounted(() => {
    disposed = true
    generation++
    clearTimeout(timer)
    controller?.abort()
  })
</script>
