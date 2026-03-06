<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div v-if="isOverviewRoute" class="mb-6">
      <h1 class="text-h4 text-md-h3 text-primary-high font-weight-bold mb-1">
        Apps
      </h1>
      <p class="text-body-2 text-secondary">
        Installed applications and runtime status
      </p>
    </div>

    <router-view v-if="!isOverviewRoute" />

    <v-row v-else>
      <v-col cols="12" lg="4" md="6">
        <glass-card
          class="h-100 hoverable-card app-card"
          @click="router.push('/apps/autodarts')"
        >
          <v-card-text>
            <div class="d-flex justify-space-between align-start mb-4">
              <v-avatar color="primary" size="48" variant="tonal">
                <v-icon icon="mdi-bullseye-arrow" />
              </v-avatar>
              <status-badge :variant="autodartsBadgeVariant">
                {{ autodartsBadgeText }}
              </status-badge>
            </div>
            <div class="text-h6 text-primary-high font-weight-bold">
              Autodarts
            </div>
            <div class="text-body-2 text-secondary mt-1">
              {{
                autodartsStatus?.installed
                  ? `Version ${autodartsStatus?.version || "n/a"}`
                  : "Install to enable smart dartboard scoring."
              }}
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
            <div class="d-flex justify-space-between align-start mb-4">
              <v-avatar color="primary" size="48" variant="tonal">
                <v-icon icon="mdi-bridge" />
              </v-avatar>
              <status-badge :variant="bridgeBadgeVariant">
                {{ bridgeBadgeText }}
              </status-badge>
            </div>

            <div class="text-h6 text-primary-high font-weight-bold">
              Vertex Bridge
            </div>
            <div class="text-body-2 text-secondary mt-1">
              {{ bridgeSummaryText }}
            </div>

            <div v-if="bridgeStatusLoading && !bridgeStatus" class="mt-4">
              <div class="d-flex align-center text-body-2 text-secondary">
                <v-progress-circular
                  class="mr-2"
                  color="primary"
                  indeterminate
                  size="18"
                  width="2"
                />
                Loading bridge status...
              </div>
            </div>

            <template v-else>
              <div v-if="bridgeInstallState === 'error' && bridgeInstallError" class="mt-4">
                <v-alert
                  class="mb-3"
                  icon="mdi-alert-circle"
                  type="error"
                  variant="tonal"
                >
                  {{ bridgeInstallError }}
                </v-alert>
              </div>

              <div v-if="bridgeInstalled" class="mt-4">
                <div class="bridge-meta-grid mb-3">
                  <div>
                    <div class="text-caption text-secondary">Version</div>
                    <div class="text-body-2 text-primary-high font-weight-medium">
                      {{ bridgeStatus?.version || 'n/a' }}
                    </div>
                  </div>
                  <div>
                    <div class="text-caption text-secondary">Health</div>
                    <div class="text-body-2 text-primary-high font-weight-medium">
                      {{ formatStateLabel(bridgeStatus?.health?.status) }}
                    </div>
                  </div>
                  <div>
                    <div class="text-caption text-secondary">Service</div>
                    <div class="text-body-2 text-primary-high font-weight-medium">
                      {{ bridgeServiceSummary }}
                    </div>
                  </div>
                  <div>
                    <div class="text-caption text-secondary">Module</div>
                    <div class="text-body-2 text-primary-high font-weight-medium">
                      {{ bridgeStatus?.module_registered ? 'Registered' : 'Missing' }}
                    </div>
                  </div>
                </div>

                <div class="d-flex flex-wrap gap-2 mb-3">
                  <v-btn
                    color="success"
                    prepend-icon="mdi-play"
                    variant="tonal"
                    :loading="bridgeServiceAction === 'start'"
                    :disabled="bridgeServiceBusy || bridgeRunning"
                    @click="handleBridgeServiceAction('start')"
                  >
                    Start
                  </v-btn>
                  <v-btn
                    color="warning"
                    prepend-icon="mdi-stop"
                    variant="tonal"
                    :loading="bridgeServiceAction === 'stop'"
                    :disabled="bridgeServiceBusy || !bridgeRunning"
                    @click="handleBridgeServiceAction('stop')"
                  >
                    Stop
                  </v-btn>
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-restart"
                    variant="tonal"
                    :loading="bridgeServiceAction === 'restart'"
                    :disabled="bridgeServiceBusy"
                    @click="handleBridgeServiceAction('restart')"
                  >
                    Restart
                  </v-btn>
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-refresh"
                    variant="outlined"
                    :loading="bridgeStatusLoading"
                    @click="handleBridgeCheckStatus"
                  >
                    Refresh
                  </v-btn>
                  <v-btn
                    v-if="bridgeUiUrl"
                    color="info"
                    prepend-icon="mdi-open-in-new"
                    variant="outlined"
                    :href="bridgeUiUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open UI
                  </v-btn>
                </div>

                <div class="bridge-log-panel mb-3">
                  <pre class="bridge-log-content">{{
                    bridgeServiceLogs || 'No service logs available'
                  }}</pre>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <v-btn
                    color="secondary"
                    prepend-icon="mdi-text-box-search"
                    variant="outlined"
                    :loading="bridgeLogsLoading"
                    @click="fetchBridgeServiceLogs"
                  >
                    Refresh logs
                  </v-btn>
                  <v-btn
                    color="secondary"
                    prepend-icon="mdi-content-copy"
                    variant="outlined"
                    @click="copyText(bridgeServiceLogs, 'Bridge service logs copied')"
                  >
                    Copy logs
                  </v-btn>
                </div>
              </div>

              <div v-else class="mt-4">
                <v-btn
                  block
                  color="primary"
                  :loading="bridgeInstallState === 'installing'"
                  :disabled="bridgeInstallState === 'installing'"
                  prepend-icon="mdi-download"
                  @click="handleBridgeInstall"
                >
                  Install
                </v-btn>
              </div>

              <div v-if="bridgeInstallState === 'installing'" class="mt-4">
                <div class="d-flex align-center text-body-2 text-secondary mb-3">
                  <v-progress-circular
                    class="mr-2"
                    color="primary"
                    indeterminate
                    size="18"
                    width="2"
                  />
                  Installing Vertex Bridge...
                </div>
                <div class="bridge-log-panel mb-3">
                  <pre class="bridge-log-content">{{
                    bridgeInstallLogs || 'Waiting for installer output...'
                  }}</pre>
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-refresh"
                    variant="outlined"
                    @click="handleBridgeCheckStatus"
                  >
                    Check status
                  </v-btn>
                  <v-btn
                    color="secondary"
                    prepend-icon="mdi-content-copy"
                    variant="outlined"
                    @click="copyText(bridgeInstallLogs, 'Bridge install logs copied')"
                  >
                    Copy logs
                  </v-btn>
                </div>
              </div>
            </template>
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
            <v-chip color="secondary" size="small" variant="outlined"
              >Coming Soon</v-chip
            >
          </v-card-text>
        </glass-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import GlassCard from "@/components/GlassCard.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useToast } from "@/composables/useToast";
import {
  getAppJobLog,
  getAppJobStatus,
  getAutodartsStatus,
  getBridgeLogs,
  getBridgeStatus,
  installVertexBridge,
  restartBridgeService,
  startBridgeService,
  stopBridgeService,
} from "@/services/api";

const BRIDGE_INSTALL_JOB_KEY = "vertex-bridge-install-job-id";
const BRIDGE_INSTALL_STARTED_AT_KEY = "vertex-bridge-install-started-at";
const BRIDGE_POLL_MS = 1500;
const BRIDGE_TIMEOUT_MS = 15 * 60 * 1000;
const BRIDGE_LOG_LINES = 200;

const route = useRoute();
const router = useRouter();
const { success, error: showError } = useToast();

const autodartsStatus = ref(null);
const boardManagerState = ref(null);
const bridgeStatus = ref(null);
const bridgeStatusLoading = ref(false);
const bridgeInstallState = ref("idle");
const bridgeInstallJobId = ref("");
const bridgeInstallStartedAt = ref(0);
const bridgeInstallStatus = ref(null);
const bridgeInstallLogs = ref("");
const bridgeInstallError = ref("");
const bridgeServiceLogs = ref("");
const bridgeLogsLoading = ref(false);
const bridgeServiceAction = ref("");
let boardManagerIntervalId = null;
let appsStatusIntervalId = null;
let bridgePollTimeoutId = null;

const isOverviewRoute = computed(() => route.path === "/apps");
const bridgeInstalled = computed(() => !!bridgeStatus.value?.installed);
const bridgeRunning = computed(() => !!bridgeStatus.value?.running);
const bridgeUiUrl = computed(() => String(bridgeStatus.value?.ui_url || ""));
const bridgeServiceBusy = computed(() => !!bridgeServiceAction.value);

const autodartsBadgeText = computed(() => {
  if (!autodartsStatus.value?.installed) return "Not Installed";
  const boardState = normalizeState(
    boardManagerState.value?.status || boardManagerState.value?.event,
  );
  if (boardState) return boardState;
  if (boardManagerState.value?.connected) {
    return boardManagerState.value?.running ? "Running" : "Stopped";
  }
  const rawStatus = String(autodartsStatus.value?.status || "");
  const apiState = normalizeState(rawStatus);
  if (apiState) return apiState;
  return autodartsStatus.value?.active ? "Running" : "Stopped";
});

const autodartsBadgeVariant = computed(() => {
  const status = autodartsBadgeText.value.toLowerCase();
  if (status === "running") return "success";
  if (status === "starting") return "info";
  if (status === "calibrating") return "warning";
  return "neutral";
});

const bridgeBadgeText = computed(() => {
  if (bridgeInstallState.value === "installing") return "Installing";
  if (bridgeInstallState.value === "error" && !bridgeInstalled.value) {
    return "Install Failed";
  }
  if (!bridgeStatus.value) return "Checking";
  if (!bridgeInstalled.value) return "Not Installed";
  return bridgeRunning.value ? "Running" : "Installed";
});

const bridgeBadgeVariant = computed(() => {
  const text = bridgeBadgeText.value.toLowerCase();
  if (text === "running") return "success";
  if (text === "installed") return "warning";
  if (text === "installing" || text === "checking") return "info";
  if (text === "install failed") return "error";
  return "neutral";
});

const bridgeSummaryText = computed(() => {
  if (!bridgeStatus.value) return "Checking bridge installation and runtime status.";
  if (!bridgeInstalled.value) {
    return "Install Vertex Bridge to expose the bridge UI and service controls.";
  }

  const version = bridgeStatus.value?.version || "n/a";
  const serviceState = formatStateLabel(
    bridgeStatus.value?.service?.active_state ||
      bridgeStatus.value?.health?.status ||
      (bridgeRunning.value ? "running" : "stopped"),
  );
  return `Version ${version} • Service ${serviceState}`;
});

const bridgeServiceSummary = computed(() => {
  const service = bridgeStatus.value?.service || {};
  const enabled = service.enabled ? "enabled" : "disabled";
  const active = formatStateLabel(service.active_state || "inactive");
  return `${active} • ${enabled}`;
});

function isAutodartsUnavailableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.status === 404 ||
    error?.status === 502 ||
    error?.status === 503 ||
    message.includes("not running") ||
    message.includes("not installed") ||
    message.includes("not found")
  );
}

function normalizeState(value) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return "";
  if (raw.includes("start")) return "Starting";
  if (raw.includes("calibrat")) return "Calibrating";
  if (raw.includes("run")) return "Running";
  if (raw.includes("stop")) return "Stopped";
  return "";
}

function formatStateLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown";
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildBoardManagerUrl(host) {
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const statePath =
    import.meta.env.VITE_BOARD_MANAGER_STATE_PATH || "/api/state";
  const normalizedPath = statePath.startsWith("/")
    ? statePath
    : `/${statePath}`;
  return `${protocol}://${host}:3180${normalizedPath}`;
}

async function fetchBoardManagerState() {
  const host =
    import.meta.env.VITE_BOARD_MANAGER_HOST ||
    (import.meta.env.DEV ? "cdo-vertex.local" : "localhost");
  const url = buildBoardManagerUrl(host);
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Board Manager request failed");
    boardManagerState.value = await response.json();
  } catch {
    boardManagerState.value = null;
  }
}

function startBoardManagerPolling() {
  if (boardManagerIntervalId) return;
  fetchBoardManagerState();
  boardManagerIntervalId = setInterval(fetchBoardManagerState, 1000);
}

function stopBoardManagerPolling() {
  if (boardManagerIntervalId) {
    clearInterval(boardManagerIntervalId);
    boardManagerIntervalId = null;
  }
}

async function fetchAppsStatus() {
  try {
    const response = await getAutodartsStatus();
    autodartsStatus.value = response.data;
    return !!autodartsStatus.value?.installed;
  } catch (error) {
    if (isAutodartsUnavailableError(error)) {
      autodartsStatus.value = { installed: false, active: false };
      stopAppsStatusPolling();
      stopBoardManagerPolling();
      return false;
    }
    showError("Failed to load app status: " + error.message);
    return false;
  }
}

function setBridgeInstallJobId(jobId) {
  bridgeInstallJobId.value = String(jobId || "");

  if (typeof window === "undefined") return;

  if (bridgeInstallJobId.value) {
    localStorage.setItem(BRIDGE_INSTALL_JOB_KEY, bridgeInstallJobId.value);
  } else {
    localStorage.removeItem(BRIDGE_INSTALL_JOB_KEY);
    localStorage.removeItem(BRIDGE_INSTALL_STARTED_AT_KEY);
  }
}

function setBridgeInstallStartedAt(startedAt) {
  bridgeInstallStartedAt.value = Number(startedAt || 0);
  if (typeof window === "undefined") return;

  if (bridgeInstallStartedAt.value > 0) {
    localStorage.setItem(
      BRIDGE_INSTALL_STARTED_AT_KEY,
      String(bridgeInstallStartedAt.value),
    );
  } else {
    localStorage.removeItem(BRIDGE_INSTALL_STARTED_AT_KEY);
  }
}

function restoreBridgeInstallState() {
  if (typeof window === "undefined") return;

  const storedJobId = localStorage.getItem(BRIDGE_INSTALL_JOB_KEY);
  const storedStartedAt = Number(
    localStorage.getItem(BRIDGE_INSTALL_STARTED_AT_KEY) || 0,
  );

  if (!storedJobId) return;

  bridgeInstallState.value = "installing";
  setBridgeInstallJobId(storedJobId);
  setBridgeInstallStartedAt(storedStartedAt || Date.now());
}

function clearBridgePolling() {
  if (bridgePollTimeoutId) {
    clearTimeout(bridgePollTimeoutId);
    bridgePollTimeoutId = null;
  }
}

async function refreshBridgeStatus({ silent = false } = {}) {
  bridgeStatusLoading.value = true;
  try {
    const response = await getBridgeStatus();
    bridgeStatus.value = response.data || null;

    if (bridgeInstalled.value) {
      bridgeInstallError.value = "";
      if (bridgeInstallState.value !== "installing") {
        bridgeInstallState.value = "success";
      }
      await fetchBridgeServiceLogs({ silent: true });
    } else if (bridgeInstallState.value !== "installing") {
      bridgeInstallState.value = "idle";
      bridgeServiceLogs.value = "";
    }

    return response.data || null;
  } catch (error) {
    if (!silent) {
      showError("Failed to refresh bridge status: " + error.message);
    }
    return null;
  } finally {
    bridgeStatusLoading.value = false;
  }
}

async function fetchBridgeInstallLog() {
  if (!bridgeInstallJobId.value) return;

  try {
    const response = await getAppJobLog(
      bridgeInstallJobId.value,
      BRIDGE_LOG_LINES,
    );
    bridgeInstallLogs.value =
      response.data?.content || bridgeInstallLogs.value || "";
  } catch {
    // Keep the latest known log tail in UI when polling log is temporarily unavailable.
  }
}

async function fetchBridgeServiceLogs({ silent = false } = {}) {
  if (!bridgeInstalled.value) return;

  bridgeLogsLoading.value = true;
  try {
    const response = await getBridgeLogs(BRIDGE_LOG_LINES);
    bridgeServiceLogs.value = response.data?.content || "";
  } catch (error) {
    if (!silent) {
      showError("Failed to load bridge logs: " + error.message);
    }
  } finally {
    bridgeLogsLoading.value = false;
  }
}

async function handleBridgeInstallPollingTick() {
  if (!bridgeInstallJobId.value) return;

  const elapsed = Date.now() - bridgeInstallStartedAt.value;
  if (elapsed > BRIDGE_TIMEOUT_MS) {
    clearBridgePolling();
    bridgeInstallState.value = "error";
    bridgeInstallError.value =
      "Install timed out. Use Check status to re-verify the backend job.";
    await fetchBridgeInstallLog();
    return;
  }

  try {
    const response = await getAppJobStatus(bridgeInstallJobId.value);
    bridgeInstallStatus.value = response.data || null;
    await fetchBridgeInstallLog();

    const finished = !!bridgeInstallStatus.value?.finished;
    const running = !!bridgeInstallStatus.value?.running;
    if (!running && finished) {
      clearBridgePolling();
      setBridgeInstallJobId("");
      setBridgeInstallStartedAt(0);

      await refreshBridgeStatus({ silent: true });
      if (bridgeInstalled.value) {
        bridgeInstallState.value = "success";
        bridgeInstallError.value = "";
        success("Vertex Bridge installed successfully");
        return;
      }

      bridgeInstallState.value = "error";
      bridgeInstallError.value =
        "Install finished but Vertex Bridge is still not installed.";
      return;
    }
  } catch (error) {
    bridgeInstallError.value = error.message;
    await fetchBridgeInstallLog();
  }

  clearBridgePolling();
  bridgePollTimeoutId = setTimeout(
    handleBridgeInstallPollingTick,
    BRIDGE_POLL_MS,
  );
}

async function startBridgeInstallPolling() {
  if (!bridgeInstallJobId.value) return;
  bridgeInstallState.value = "installing";
  clearBridgePolling();
  bridgePollTimeoutId = setTimeout(handleBridgeInstallPollingTick, 0);
}

async function handleBridgeInstall() {
  if (bridgeInstallState.value === "installing") return;

  bridgeInstallError.value = "";
  bridgeInstallLogs.value = "";
  bridgeInstallStatus.value = null;

  try {
    const response = await installVertexBridge({
      version: "latest",
      port: "9920",
    });
    const result = response.data || {};

    if (!result.job_id) {
      bridgeInstallState.value = "error";
      bridgeInstallError.value =
        result.error || "Install did not return a job id.";
      return;
    }

    setBridgeInstallJobId(result.job_id);
    setBridgeInstallStartedAt(Date.now());
    bridgeInstallState.value = "installing";
    await startBridgeInstallPolling();
  } catch (error) {
    bridgeInstallState.value = "error";
    bridgeInstallError.value = error.message;
    showError("Failed to start bridge install: " + error.message);
  }
}

async function handleBridgeCheckStatus() {
  if (bridgeInstallJobId.value) {
    bridgeInstallState.value = "installing";
    await startBridgeInstallPolling();
    return;
  }

  await refreshBridgeStatus();
  if (bridgeInstalled.value) {
    success("Bridge status refreshed");
  }
}

async function handleBridgeServiceAction(action) {
  const actionMap = {
    start: { fn: startBridgeService, label: "started" },
    stop: { fn: stopBridgeService, label: "stopped" },
    restart: { fn: restartBridgeService, label: "restarted" },
  };
  const target = actionMap[action];
  if (!target) return;

  bridgeServiceAction.value = action;
  try {
    await target.fn();
    await refreshBridgeStatus({ silent: true });
    await fetchBridgeServiceLogs({ silent: true });
    success(`Bridge service ${target.label}`);
  } catch (error) {
    showError(`Failed to ${action} bridge service: ${error.message}`);
  } finally {
    bridgeServiceAction.value = "";
  }
}

async function copyText(text, successMessage) {
  const value = String(text || "").trim();
  if (!value) {
    showError("No logs available to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    success(successMessage);
  } catch (error) {
    showError("Failed to copy logs: " + error.message);
  }
}

async function startAppsStatusPolling() {
  if (appsStatusIntervalId) return;
  const isInstalled = await fetchAppsStatus();
  if (!isInstalled) {
    stopBoardManagerPolling();
    return;
  }
  startBoardManagerPolling();
  appsStatusIntervalId = setInterval(fetchAppsStatus, 1000);
}

function stopAppsStatusPolling() {
  if (appsStatusIntervalId) {
    clearInterval(appsStatusIntervalId);
    appsStatusIntervalId = null;
  }
}

watch(
  () => route.path,
  async (newPath) => {
    if (newPath === "/apps") {
      await startAppsStatusPolling();
      await refreshBridgeStatus({ silent: true });
    } else {
      stopAppsStatusPolling();
      stopBoardManagerPolling();
    }
  },
);

onMounted(async () => {
  restoreBridgeInstallState();

  if (isOverviewRoute.value) {
    await startAppsStatusPolling();
  }

  await refreshBridgeStatus({ silent: true });

  if (bridgeInstallJobId.value) {
    await startBridgeInstallPolling();
  }
});

onUnmounted(() => {
  stopAppsStatusPolling();
  stopBoardManagerPolling();
  clearBridgePolling();
});
</script>

<style scoped>
.app-card {
  cursor: pointer;
}

.bridge-meta-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.bridge-log-panel {
  background: color-mix(in srgb, var(--app-surface-strong) 80%, transparent);
  border-radius: 8px;
  max-height: 220px;
  overflow: auto;
  padding: 10px;
}

.bridge-log-content {
  font-family: "Courier New", monospace;
  font-size: 12px;
  line-height: 1.45;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

@media (max-width: 600px) {
  .bridge-meta-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>



