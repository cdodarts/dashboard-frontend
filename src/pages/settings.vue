<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div class="mb-6">
      <h1 class="text-h4 text-md-h3 text-primary-high font-weight-bold mb-1">Settings</h1>
      <p class="text-body-2 text-secondary">Configure theme and notifications</p>
    </div>

    <div v-if="loading && !settings" class="text-center py-16">
      <v-progress-circular color="primary" indeterminate size="64" />
      <div class="text-body-1 text-secondary mt-4">Loading settings...</div>
    </div>

    <div v-else>
      <v-row>
        <v-col cols="12" lg="6">
          <glass-card class="mb-4" elevated>
            <v-card-title class="text-primary-high d-flex align-center">
              <v-icon class="mr-2" icon="mdi-palette" />Display Settings
            </v-card-title>
            <v-card-text>
              <div>
                <div class="text-body-2 text-primary-medium mb-3">Theme</div>
                <v-btn-toggle
                  v-model="localSettings.display.theme"
                  class="w-100"
                  color="primary"
                  divided
                  mandatory
                  variant="outlined"
                >
                  <v-btn class="flex-1-1" value="dark"><v-icon class="mr-2" icon="mdi-weather-night" />Dark</v-btn>
                  <v-btn class="flex-1-1" value="light"><v-icon class="mr-2" icon="mdi-white-balance-sunny" />Light</v-btn>
                </v-btn-toggle>
                <div class="text-caption text-secondary mt-3">Dashboard data refresh is fixed at every 5 seconds.</div>
              </div>
            </v-card-text>
          </glass-card>

          <glass-card class="mb-4">
            <v-card-title class="text-primary-high d-flex align-center"><v-icon class="mr-2" icon="mdi-bell" />Notifications</v-card-title>
            <v-card-text>
              <v-switch
                v-model="localSettings.notifications.update_available"
                class="mb-4"
                color="primary"
                hide-details
                label="Notify when updates are available"
              />
              <v-switch v-model="localSettings.notifications.installation_complete" color="primary" hide-details label="Notify when installation completes" />
            </v-card-text>
          </glass-card>

          <glass-card>
            <v-card-title class="text-primary-high d-flex align-center">
              <v-icon class="mr-2" icon="mdi-wifi" />Network Setup
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 text-secondary mb-0">
                Network onboarding is now handled by the backend host flow before the dashboard loads.
              </p>
            </v-card-text>
          </glass-card>

          <glass-card class="mt-4">
            <v-card-title class="text-primary-high d-flex align-center">
              <v-icon class="mr-2" icon="mdi-update" />Check for Updates
            </v-card-title>
            <v-card-text>
              <div class="d-flex flex-column ga-3">
                <p class="text-body-2 text-secondary mb-0">Use this to check for software updates and apply them manually.</p>
                <div class="d-flex flex-wrap ga-2">
                  <v-btn
                    color="primary"
                    :disabled="checkingUpdates || applyingUpdate"
                    :loading="checkingUpdates"
                    prepend-icon="mdi-refresh"
                    variant="outlined"
                    @click="handleCheckUpdates"
                  >Check for updates</v-btn>
                  <v-btn
                    v-if="hasUpdateAvailable"
                    color="warning"
                    :disabled="checkingUpdates || applyingUpdate"
                    :loading="applyingUpdate"
                    prepend-icon="mdi-download"
                    @click="handleApplyUpdate"
                  >Update now</v-btn>
                </div>

                <v-alert
                  v-if="updateStatus"
                  density="comfortable"
                  :type="updateStatus.type"
                  variant="tonal"
                >
                  <div class="text-body-2">{{ updateStatus.message }}</div>
                  <div v-if="hasUpdateAvailable" class="text-caption mt-1">
                    {{ updateDetails }}
                  </div>
                </v-alert>
              </div>
            </v-card-text>
          </glass-card>
        </v-col>

      </v-row>

      <glass-card class="mt-6">
        <v-card-text>
          <div class="d-flex flex-column flex-sm-row gap-3 justify-end">
            <v-btn
              color="error"
              :disabled="saving"
              :loading="resetting"
              prepend-icon="mdi-restore"
              variant="outlined"
              @click="handleReset"
            >Reset to Defaults</v-btn>
            <v-btn
              color="primary"
              :disabled="resetting || !hasChanges"
              :loading="saving"
              prepend-icon="mdi-content-save"
              size="large"
              @click="handleSave"
            >Save Settings</v-btn>
          </div>
        </v-card-text>
      </glass-card>
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
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useTheme } from 'vuetify'
  import GlassCard from '@/components/GlassCard.vue'
  import { useToast } from '@/composables/useToast'
  import { applyUpdates, checkUpdates, getSettings, resetSettings, updateSettings, getUpdateStatus } from '@/services/api'

  const { success, error: showError } = useToast()
  const theme = useTheme()

  const loading = ref(false)
  const saving = ref(false)
  const resetting = ref(false)
  const settings = ref(null)
  const checkingUpdates = ref(false)
  const applyingUpdate = ref(false)
  const updateResult = ref(null)
  const showUpdateDialog = ref(false)
  const updateStatusText = ref('Starting update...')
  const updateJobId = ref(null)
  const updateLogPath = ref('')
  const updateFailed = ref(false)
  const updateError = ref('')
  let updatePollTimer = null
  const UPDATE_POLL_MS = 3000

  const localSettings = ref({
    auto_update: { enabled: false, check_interval_hours: 24, check_time: '03:00', auto_install: false },
    notifications: { update_available: true, installation_complete: true },
    display: { theme: 'dark', refresh_interval_seconds: 5 },
  })

  function applyTheme (themeName) {
    const targetTheme = themeName === 'light' ? 'light' : 'dark'
    theme.change(targetTheme)
    localStorage.setItem('vertex-theme', targetTheme)
  }

  watch(() => localSettings.value.display.theme, newTheme => {
    applyTheme(newTheme)
  })

  const hasChanges = computed(() => {
    if (!settings.value) return false
    return JSON.stringify(settings.value) !== JSON.stringify(localSettings.value)
  })

  const hasUpdateAvailable = computed(() => (updateResult.value?.components || []).some(component => component.update_available))

  const updateDetails = computed(() => {
    const component = (updateResult.value?.components || []).find(item => item.update_available)
    if (!component) return ''
    return `${component.name}: ${component.current_version} → ${component.latest_version}`
  })

  const updateStatus = computed(() => {
    if (!updateResult.value) return null
    if (hasUpdateAvailable.value) {
      return { type: 'warning', message: 'Update available. Click "Update now" to install.' }
    }
    return { type: 'success', message: 'Device is up to date.' }
  })

  async function fetchSettings () {
    try {
      loading.value = true
      const response = await getSettings()
      settings.value = response.data
      localSettings.value = structuredClone(response.data)
      localSettings.value.display.refresh_interval_seconds = 5
      applyTheme(localSettings.value.display.theme)
    } catch (error) {
      showError('Failed to load settings: ' + error.message)
    } finally {
      loading.value = false
    }
  }

  async function handleSave () {
    try {
      saving.value = true
      localSettings.value.display.refresh_interval_seconds = 5
      const response = await updateSettings(localSettings.value)
      settings.value = response.data.settings
      localSettings.value = structuredClone(response.data.settings)
      localSettings.value.display.refresh_interval_seconds = 5
      applyTheme(localSettings.value.display.theme)
      success('Settings saved successfully')
    } catch (error) {
      showError('Failed to save settings: ' + error.message)
    } finally {
      saving.value = false
    }
  }

  async function handleCheckUpdates () {
    try {
      checkingUpdates.value = true
      const response = await checkUpdates()
      updateResult.value = response.data
      if (hasUpdateAvailable.value) success('Update available')
      else success('Device is up to date')
    } catch (error) {
      showError('Failed to check for updates: ' + error.message)
    } finally {
      checkingUpdates.value = false
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
        showError(result.error || 'Update command failed')
      }
      await handleCheckUpdates()
    } catch (error) {
      showError('Failed to apply updates: ' + error.message)
    } finally {
      applyingUpdate.value = false
    }
  }

  async function handleReset () {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return
    try {
      resetting.value = true
      const response = await resetSettings()
      settings.value = response.data.settings
      localSettings.value = structuredClone(response.data.settings)
      localSettings.value.display.refresh_interval_seconds = 5
      applyTheme(localSettings.value.display.theme)
      success('Settings reset to defaults')
    } catch (error) {
      showError('Failed to reset settings: ' + error.message)
    } finally {
      resetting.value = false
    }
  }

  onMounted(async () => {
    await fetchSettings()
    await handleCheckUpdates()
  })

  onUnmounted(() => {
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

<style scoped>
.flex-1-1 { flex: 1 1 0; }
.w-100 { width: 100%; }
</style>
