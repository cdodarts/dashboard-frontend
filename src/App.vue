<template>
  <v-app>
    <v-app-bar
      v-if="!mobile"
      app
      class="glass-card-elevated"
      elevation="0"
      height="72"
    >
      <template #prepend>
        <div class="d-flex align-center ml-4">
          <v-icon class="mr-3" color="primary" icon="mdi-raspberry-pi" size="32" />
          <div>
            <div class="text-h6 text-primary-high font-weight-bold">
              CDO Vertex
            </div>
            <div class="text-caption text-secondary">
              Device Control Center
            </div>
          </div>
        </div>
      </template>

      <template #append>
        <v-tabs
          v-model="currentTab"
          align-tabs="end"
          class="mr-4"
          color="primary"
        >
          <v-tab prepend-icon="mdi-view-dashboard" value="/" @click="navigate('/')">Dashboard</v-tab>
          <v-tab prepend-icon="mdi-chart-box" value="/status" @click="navigate('/status')">Status</v-tab>
          <v-tab prepend-icon="mdi-apps" value="/apps" @click="navigate('/apps')">Apps</v-tab>
          <v-tab prepend-icon="mdi-cog" value="/settings" @click="navigate('/settings')">Settings</v-tab>
        </v-tabs>
      </template>
    </v-app-bar>

    <v-app-bar
      v-else
      app
      class="glass-card-elevated"
      elevation="0"
      height="64"
    >
      <template #prepend>
        <div class="d-flex align-center ml-2">
          <v-icon class="mr-2" color="primary" icon="mdi-raspberry-pi" size="28" />
          <div class="text-h6 text-primary-high font-weight-bold">
            CDO Vertex
          </div>
        </div>
      </template>
    </v-app-bar>

    <v-main>
      <system-status-bar />
      <router-view />
    </v-main>

    <v-bottom-navigation
      v-if="mobile"
      v-model="currentTab"
      app
      class="glass-card-elevated"
      grow
      height="64"
    >
      <v-btn value="/" @click="navigate('/')">
        <v-icon>mdi-view-dashboard</v-icon>
        <span>Dashboard</span>
      </v-btn>

      <v-btn value="/status" @click="navigate('/status')">
        <v-icon>mdi-chart-box</v-icon>
        <span>Status</span>
      </v-btn>

      <v-btn value="/apps" @click="navigate('/apps')">
        <v-icon>mdi-apps</v-icon>
        <span>Apps</span>
      </v-btn>

      <v-btn value="/settings" @click="navigate('/settings')">
        <v-icon>mdi-cog</v-icon>
        <span>Settings</span>
      </v-btn>
    </v-bottom-navigation>

    <toast-container />
  </v-app>
</template>

<script setup>
  import { onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import SystemStatusBar from '@/components/SystemStatusBar.vue'
  import ToastContainer from '@/components/ToastContainer.vue'

  const router = useRouter()
  const route = useRoute()
  const { mobile } = useDisplay()

  const currentTab = ref('/')

  function getNavigationTab (path) {
    if (path.startsWith('/apps')) return '/apps'
    if (path.startsWith('/status')) return '/status'
    if (path.startsWith('/settings')) return '/settings'
    return '/'
  }

  function navigate (path) {
    if (route.path !== path) {
      router.push(path)
    }
  }

  watch(
    () => route.path,
    newPath => {
      currentTab.value = getNavigationTab(newPath)
    },
    { immediate: true },
  )

  onMounted(() => {
    currentTab.value = getNavigationTab(route.path)
  })
</script>

<style>
.v-main {
  padding-bottom: calc(var(--v-layout-bottom) + env(safe-area-inset-bottom)) !important;
}

.v-main > .v-container {
  padding-top: 12px !important;
}

@media (min-width: 960px) {
  .v-main > .v-container {
    padding-top: 16px !important;
  }
}

.v-main ::-webkit-scrollbar {
  width: 8px;
}

.v-main ::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--app-surface-strong) 80%, transparent);
}

.v-main ::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--app-text-muted) 50%, transparent);
  border-radius: 4px;
}

.v-main ::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--app-text-muted) 65%, transparent);
}
</style>
