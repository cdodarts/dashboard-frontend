<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-3">
      <div>
        <h1 class="text-h4 text-md-h3 text-primary-high font-weight-bold mb-1">Device Status</h1>
        <p class="text-body-2 text-secondary">Detailed live monitoring for hardware and network health</p>
      </div>
      <connection-status :connected="isConnected" />
    </div>

    <div v-if="loading && !systemData" class="text-center py-16">
      <v-progress-circular color="primary" indeterminate size="64" />
      <div class="text-body-1 text-secondary mt-4">Loading system status...</div>
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

    <div v-else>
      <div class="mb-4">
        <system-info-card
          :api-version="apiVersion"
          :hostname-data="systemData?.hostname"
          :uptime-data="systemData?.uptime"
        />
      </div>

      <v-row>
        <v-col cols="12" lg="4" sm="6"><cpu-card :data="systemData?.cpu" /></v-col>
        <v-col cols="12" lg="4" sm="6"><memory-card :data="systemData?.memory" /></v-col>
        <v-col cols="12" lg="4" sm="6"><disk-card :data="systemData?.disk" /></v-col>
        <v-col cols="12" lg="4" sm="6"><temperature-card :data="systemData?.temperature" /></v-col>
        <v-col cols="12" lg="4" sm="6">
          <network-card :network-data="systemData?.network" :wifi-data="enrichedWifiData" />
        </v-col>
        <v-col cols="12" lg="4" sm="6">
          <glass-card class="h-100 d-flex flex-column justify-space-between">
            <v-card-text>
              <div class="text-caption text-secondary mb-2">Apps</div>
              <div class="text-h6 text-primary-high font-weight-bold mb-2">Installed Apps</div>
              <div class="text-body-2 text-secondary">View runtime and controls for installed apps.</div>
            </v-card-text>
            <v-card-actions>
              <v-btn
                block
                color="primary"
                prepend-icon="mdi-apps"
                variant="tonal"
                @click="router.push('/apps')"
              >
                Open Apps
              </v-btn>
            </v-card-actions>
          </glass-card>
        </v-col>
      </v-row>

      <div class="text-center mt-6">
        <div class="text-caption text-secondary">Last updated: {{ lastUpdated }}</div>
      </div>
    </div>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import CpuCard from '@/components/cards/CPUCard.vue'
  import DiskCard from '@/components/cards/DiskCard.vue'
  import MemoryCard from '@/components/cards/MemoryCard.vue'
  import NetworkCard from '@/components/cards/NetworkCard.vue'
  import SystemInfoCard from '@/components/cards/SystemInfoCard.vue'
  import TemperatureCard from '@/components/cards/TemperatureCard.vue'
  import ConnectionStatus from '@/components/ConnectionStatus.vue'
  import GlassCard from '@/components/GlassCard.vue'
  import { useToast } from '@/composables/useToast'
  import { getHealth, getSystemStatus } from '@/services/api'

  const router = useRouter()
  const { error: showError } = useToast()

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

  const enrichedWifiData = computed(() => systemData.value?.wifi || null)

  async function fetchData () {
    try {
      loading.value = true
      error.value = null
      const response = await getSystemStatus()
      systemData.value = response.data
      isConnected.value = true
      lastUpdated.value = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch (error_) {
      error.value = error_.message
      rawError.value = error_
      isConnected.value = false
      showError('Failed to fetch system data: ' + error_.message)
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
