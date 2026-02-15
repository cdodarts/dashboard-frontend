import axios from 'axios'

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://cdo-vertex.local'
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '')
const API_PREFIX = API_BASE_URL.endsWith('/api') ? '' : '/api'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    const errorMessage = error.response?.data?.error || error.message || 'An unknown error occurred'
    const status = error.response?.status
    const baseUrl = error.config?.baseURL || ''
    const requestPath = error.config?.url || ''
    const requestUrl = `${baseUrl}${requestPath}`

    console.error('API request failed', {
      message: errorMessage,
      status,
      code: error.code,
      url: requestUrl,
      method: error.config?.method,
      timeout: error.config?.timeout,
    })

    const wrappedError = new Error(errorMessage)
    wrappedError.status = status
    wrappedError.code = error.code
    wrappedError.requestUrl = requestUrl
    wrappedError.raw = error
    return Promise.reject(wrappedError)
  },
)

// ========== Health Check ==========
export const getHealth = () => apiClient.get(`${API_PREFIX}/health`)

// ========== System Monitoring ==========
export const getSystemStatus = () => apiClient.get(`${API_PREFIX}/system/status`)
export const getCPU = () => apiClient.get(`${API_PREFIX}/system/cpu`)
export const getMemory = () => apiClient.get(`${API_PREFIX}/system/memory`)
export const getDisk = () => apiClient.get(`${API_PREFIX}/system/disk`)
export const getTemperature = () => apiClient.get(`${API_PREFIX}/system/temperature`)
export const getNetwork = () => apiClient.get(`${API_PREFIX}/system/network`)
export const getWifi = () => apiClient.get(`${API_PREFIX}/system/wifi`)
export const getConnectivity = () => apiClient.get(`${API_PREFIX}/system/connectivity`)

export const getUptime = () => apiClient.get(`${API_PREFIX}/system/uptime`)
export const getHostname = () => apiClient.get(`${API_PREFIX}/system/hostname`)

// ========== Autodarts Management ==========
export const getAutodartsStatus = () => apiClient.get(`${API_PREFIX}/autodarts/status`)

export function installAutodarts (data = {}) {
  return apiClient.post(`${API_PREFIX}/autodarts/install`, data)
}

export function updateAutodarts (data = {}) {
  return apiClient.post(`${API_PREFIX}/autodarts/update`, data)
}

export function checkAutodartsUpdate () {
  return apiClient.get(`${API_PREFIX}/autodarts/check-update`)
}

export function startAutodartsService () {
  return apiClient.post(`${API_PREFIX}/autodarts/service/start`)
}

export function stopAutodartsService () {
  return apiClient.post(`${API_PREFIX}/autodarts/service/stop`)
}

export function restartAutodartsService () {
  return apiClient.post(`${API_PREFIX}/autodarts/service/restart`)
}

export function getAutodartsLogs (lines = 50) {
  return apiClient.get(`${API_PREFIX}/autodarts/logs`, { params: { lines } })
}

// ========== Camera Management ==========
const CAMERA_PLACEHOLDER_FEEDS = [
  {
    id: 'camera-1',
    name: 'Camera 1',
    active: false,
    feed_url: 'https://placehold.co/1280x720/111827/94a3b8?text=Camera+1+Feed',
  },
]

export async function getCameras () {
  try {
    return await apiClient.get(`${API_PREFIX}/cameras`)
  } catch {
    return { data: { cameras: CAMERA_PLACEHOLDER_FEEDS } }
  }
}

export function startCameras () {
  return apiClient.post(`${API_PREFIX}/cameras/start`)
}

export function stopCameras () {
  return apiClient.post(`${API_PREFIX}/cameras/stop`)
}

// ========== Settings ==========
export const getSettings = () => apiClient.get(`${API_PREFIX}/settings`)

export function updateSettings (data) {
  return apiClient.post(`${API_PREFIX}/settings`, data)
}

export function getAutoUpdateSettings () {
  return apiClient.get(`${API_PREFIX}/settings/auto-update`)
}

export function updateAutoUpdateSettings (data) {
  return apiClient.post(`${API_PREFIX}/settings/auto-update`, data)
}

export function resetSettings () {
  return apiClient.post(`${API_PREFIX}/settings/reset`)
}

export default apiClient
