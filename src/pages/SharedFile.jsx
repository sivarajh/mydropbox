import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getShare } from '../lib/api'
import { proxySharedDownload, saveBlob } from '../lib/proxy'
import { formatBytes, fileIcon } from '../lib/format'

export default function SharedFile() {
  const { token } = useParams()
  const [share, setShare] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | missing | expired
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getShare(token)
      .then((data) => {
        if (!data) return setState('missing')
        if (new Date(data.expires_at) < new Date()) return setState('expired')
        setShare(data)
        setState('ok')
      })
      .catch(() => setState('missing'))
  }, [token])

  async function handleDownload() {
    setError('')
    setDownloading(true)
    try {
      const { blob, name } = await proxySharedDownload(token)
      saveBlob(blob, share.file_name || name)
    } catch (e) {
      setError(`Download failed: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card share-view">
        <div className="brand">
          <span className="logo">📦</span>
          <h1>myDropbox</h1>
        </div>

        {state === 'loading' && <p className="muted">Loading…</p>}

        {state === 'missing' && (
          <div className="alert error">
            This share link is invalid or has been removed.
          </div>
        )}

        {state === 'expired' && (
          <div className="alert error">This share link has expired.</div>
        )}

        {state === 'ok' && share && (
          <>
            <div className="share-file">
              <span className="big-icon">
                {fileIcon(share.mime_type, share.file_name)}
              </span>
              <div>
                <div className="name">{share.file_name}</div>
                <div className="muted small">{formatBytes(share.size)}</div>
              </div>
            </div>
            {error && <div className="alert error">{error}</div>}
            <button
              className="btn primary block"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Preparing download…' : 'Download'}
            </button>
          </>
        )}

        <p className="switch">
          <Link className="link" to="/">
            Go to myDropbox
          </Link>
        </p>
      </div>
    </div>
  )
}
