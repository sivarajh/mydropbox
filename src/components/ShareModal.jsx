import { useEffect, useState } from 'react'
import { createShare, shareLink } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function ShareModal({ file, onClose }) {
  const { user } = useAuth()
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    createShare(file, user.id)
      .then((share) => active && setLink(shareLink(share.token)))
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [file, user.id])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked; the field is selectable as a fallback */
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Share “{file.name}”</h3>
        {error ? (
          <div className="alert error">{error}</div>
        ) : link ? (
          <>
            <p className="muted">Anyone with this link can download the file.</p>
            <div className="copy-row">
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="btn primary" onClick={copy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="muted small">Link expires in 30 days.</p>
          </>
        ) : (
          <p className="muted">Creating link…</p>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
