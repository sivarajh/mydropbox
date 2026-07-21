import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getShare } from '../lib/api'
import { formatBytes, fileIcon } from '../lib/format'

export default function SharedFile() {
  const { token } = useParams()
  const [share, setShare] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | missing | expired

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
            <a className="btn primary block" href={share.signed_url}>
              Download
            </a>
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
