import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listFolder,
  getBreadcrumbs,
  createFolder,
  renameFolder,
  deleteFolder,
  uploadFile,
  renameFile,
  deleteFile,
  getDownloadUrl,
} from '../lib/api'
import { formatBytes, fileIcon } from '../lib/format'
import Breadcrumbs from '../components/Breadcrumbs'
import ShareModal from '../components/ShareModal'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { folderId } = useParams()
  const navigate = useNavigate()
  const fileInput = useRef(null)

  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [trail, setTrail] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(0) // number of in-flight uploads
  const [dragging, setDragging] = useState(false)
  const [sharing, setSharing] = useState(null) // file being shared

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [{ folders, files }, crumbs] = await Promise.all([
        listFolder(folderId ?? null),
        folderId ? getBreadcrumbs(folderId) : Promise.resolve([]),
      ])
      setFolders(folders)
      setFiles(files)
      setTrail(crumbs)
    } catch (e) {
      setError(e.message || 'Failed to load files.')
    } finally {
      setLoading(false)
    }
  }, [folderId])

  useEffect(() => {
    load()
  }, [load])

  async function handleUpload(fileList) {
    const items = Array.from(fileList)
    if (!items.length) return
    setError('')
    setUploading((n) => n + items.length)
    for (const file of items) {
      try {
        await uploadFile(file, folderId ?? null, user.id)
      } catch (e) {
        setError(`Upload failed for ${file.name}: ${e.message}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    load()
  }

  async function handleNewFolder() {
    const name = window.prompt('Folder name')?.trim()
    if (!name) return
    try {
      await createFolder(name, folderId ?? null, user.id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleRenameFolder(folder) {
    const name = window.prompt('Rename folder', folder.name)?.trim()
    if (!name || name === folder.name) return
    await renameFolder(folder.id, name).catch((e) => setError(e.message))
    load()
  }

  async function handleDeleteFolder(folder) {
    if (!window.confirm(`Delete “${folder.name}” and everything inside it?`))
      return
    await deleteFolder(folder.id).catch((e) => setError(e.message))
    load()
  }

  async function handleRenameFile(file) {
    const name = window.prompt('Rename file', file.name)?.trim()
    if (!name || name === file.name) return
    await renameFile(file.id, name).catch((e) => setError(e.message))
    load()
  }

  async function handleDeleteFile(file) {
    if (!window.confirm(`Delete “${file.name}”?`)) return
    await deleteFile(file).catch((e) => setError(e.message))
    load()
  }

  async function handleDownload(file) {
    try {
      const url = await getDownloadUrl(file)
      window.location.href = url
    } catch (e) {
      setError(e.message)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files)
  }

  const empty = !loading && folders.length === 0 && files.length === 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand small">
          <span className="logo">📦</span>
          <span>myDropbox</span>
        </div>
        <div className="topbar-right">
          <span className="muted small">{user.email}</span>
          <button className="btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main
        className={`content ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="toolbar">
          <Breadcrumbs trail={trail} />
          <div className="toolbar-actions">
            <button className="btn" onClick={handleNewFolder}>
              New folder
            </button>
            <button
              className="btn primary"
              onClick={() => fileInput.current?.click()}
            >
              Upload
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                handleUpload(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}
        {uploading > 0 && (
          <div className="alert notice">
            Uploading {uploading} file{uploading > 1 ? 's' : ''}…
          </div>
        )}

        {loading ? (
          <div className="muted center">Loading…</div>
        ) : empty ? (
          <div className="empty">
            <div className="empty-icon">🗂️</div>
            <p>This folder is empty.</p>
            <p className="muted small">
              Drag files here, or use the Upload button.
            </p>
          </div>
        ) : (
          <ul className="listing">
            {folders.map((folder) => (
              <li key={folder.id} className="row">
                <button
                  className="row-main"
                  onClick={() => navigate(`/folder/${folder.id}`)}
                >
                  <span className="icon">📁</span>
                  <span className="name">{folder.name}</span>
                </button>
                <span className="meta">Folder</span>
                <div className="row-actions">
                  <button
                    className="link"
                    onClick={() => handleRenameFolder(folder)}
                  >
                    Rename
                  </button>
                  <button
                    className="link danger"
                    onClick={() => handleDeleteFolder(folder)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}

            {files.map((file) => (
              <li key={file.id} className="row">
                <button className="row-main" onClick={() => handleDownload(file)}>
                  <span className="icon">
                    {fileIcon(file.mime_type, file.name)}
                  </span>
                  <span className="name">{file.name}</span>
                </button>
                <span className="meta">{formatBytes(file.size)}</span>
                <div className="row-actions">
                  <button className="link" onClick={() => setSharing(file)}>
                    Share
                  </button>
                  <button className="link" onClick={() => handleDownload(file)}>
                    Download
                  </button>
                  <button className="link" onClick={() => handleRenameFile(file)}>
                    Rename
                  </button>
                  <button
                    className="link danger"
                    onClick={() => handleDeleteFile(file)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {dragging && <div className="drop-hint">Drop files to upload</div>}
      </main>

      {sharing && (
        <ShareModal file={sharing} onClose={() => setSharing(null)} />
      )}
    </div>
  )
}
