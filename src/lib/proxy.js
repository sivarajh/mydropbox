import { supabase } from './supabase'

const PROXY_URL = import.meta.env.VITE_PROXY_URL

export const proxyConfigured = Boolean(PROXY_URL)

async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

// The request body is a plain string with no custom headers, so the browser
// treats it as a CORS "simple request" (no OPTIONS preflight) — which is what
// Apps Script web apps support.
async function call(payload) {
  if (!PROXY_URL) throw new Error('VITE_PROXY_URL is not set')
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------
export async function proxyUpload(file) {
  const token = await accessToken()
  const dataBase64 = await fileToBase64(file)
  const { id, size } = await call({
    action: 'upload',
    token,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    dataBase64,
  })
  return { id, size }
}

export async function proxyDownload(driveId) {
  const token = await accessToken()
  const { name, mimeType, dataBase64 } = await call({
    action: 'download',
    token,
    id: driveId,
  })
  return { blob: base64ToBlob(dataBase64, mimeType), name }
}

export async function proxyDelete(ids) {
  if (!ids.length) return
  const token = await accessToken()
  return call({ action: 'delete', token, ids })
}

export async function proxySharedDownload(shareToken) {
  const { name, mimeType, dataBase64 } = await call({
    action: 'shared',
    share: shareToken,
  })
  return { blob: base64ToBlob(dataBase64, mimeType), name }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64 || '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

// Save a fetched Blob to disk with the given filename.
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
