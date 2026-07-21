export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

// A rough emoji icon based on file type — keeps the UI lively without assets.
export function fileIcon(mime = '', name = '') {
  const m = mime || ''
  const ext = name.split('.').pop()?.toLowerCase()
  if (m.startsWith('image/')) return '🖼️'
  if (m.startsWith('video/')) return '🎬'
  if (m.startsWith('audio/')) return '🎵'
  if (m === 'application/pdf' || ext === 'pdf') return '📕'
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return '🗜️'
  if (['doc', 'docx'].includes(ext)) return '📘'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📗'
  if (['ppt', 'pptx'].includes(ext)) return '📙'
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'html', 'css', 'json'].includes(ext))
    return '💻'
  if (['txt', 'md'].includes(ext)) return '📄'
  return '📄'
}
