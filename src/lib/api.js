import { supabase, BUCKET } from './supabase'

// How long share links and download links stay valid (seconds).
const SHARE_TTL = 60 * 60 * 24 * 30 // 30 days
const DOWNLOAD_TTL = 60 // 1 minute — just long enough to start the download

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export async function listFolder(folderId) {
  // Postgrest needs `eq` for a value and `is` for NULL — pick per folderId.
  const [{ data: folders, error: fErr }, { data: files, error: flErr }] =
    await Promise.all([
      supabase
        .from('folders')
        .select('*')
        .filter('parent_id', folderId ? 'eq' : 'is', folderId ?? null)
        .order('name'),
      supabase
        .from('files')
        .select('*')
        .filter('folder_id', folderId ? 'eq' : 'is', folderId ?? null)
        .order('name'),
    ])

  if (fErr) throw fErr
  if (flErr) throw flErr
  return { folders: folders ?? [], files: files ?? [] }
}

// Walk up the parent chain to build breadcrumb trail for the current folder.
export async function getBreadcrumbs(folderId) {
  const trail = []
  let current = folderId
  while (current) {
    const { data, error } = await supabase
      .from('folders')
      .select('id, name, parent_id')
      .eq('id', current)
      .single()
    if (error || !data) break
    trail.unshift({ id: data.id, name: data.name })
    current = data.parent_id
  }
  return trail
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function createFolder(name, parentId, ownerId) {
  const { data, error } = await supabase
    .from('folders')
    .insert({ name, parent_id: parentId ?? null, owner_id: ownerId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameFolder(id, name) {
  const { error } = await supabase.from('folders').update({ name }).eq('id', id)
  if (error) throw error
}

// Deletes a folder and everything under it. The DB cascades child folders and
// file rows, but the actual Storage blobs must be removed explicitly first.
export async function deleteFolder(folderId) {
  const paths = await collectStoragePaths(folderId)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
  const { error } = await supabase.from('folders').delete().eq('id', folderId)
  if (error) throw error
}

async function collectStoragePaths(folderId) {
  const paths = []
  const { data: files } = await supabase
    .from('files')
    .select('storage_path')
    .eq('folder_id', folderId)
  ;(files ?? []).forEach((f) => paths.push(f.storage_path))

  const { data: subfolders } = await supabase
    .from('folders')
    .select('id')
    .eq('parent_id', folderId)
  for (const sub of subfolders ?? []) {
    paths.push(...(await collectStoragePaths(sub.id)))
  }
  return paths
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export async function uploadFile(file, folderId, ownerId, onProgress) {
  // Store under "<uid>/<uuid>-<name>" so paths are unique and RLS-scoped.
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${ownerId}/${crypto.randomUUID()}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('files')
    .insert({
      name: file.name,
      folder_id: folderId ?? null,
      owner_id: ownerId,
      storage_path: path,
      size: file.size,
      mime_type: file.type || null,
    })
    .select()
    .single()

  if (error) {
    // Roll back the orphaned blob if the metadata insert fails.
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  if (onProgress) onProgress(1)
  return data
}

export async function renameFile(id, name) {
  const { error } = await supabase.from('files').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteFile(file) {
  await supabase.storage.from(BUCKET).remove([file.storage_path])
  const { error } = await supabase.from('files').delete().eq('id', file.id)
  if (error) throw error
}

// Signed URL used to download the user's own file. forceDownload sets the
// Content-Disposition so the browser saves it instead of navigating.
export async function getDownloadUrl(file) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, DOWNLOAD_TTL, { download: file.name })
  if (error) throw error
  return data.signedUrl
}

// ---------------------------------------------------------------------------
// Shares
// ---------------------------------------------------------------------------

export async function createShare(file, ownerId) {
  // Reuse an existing, non-expired share for this file if there is one.
  const { data: existing } = await supabase
    .from('shares')
    .select('*')
    .eq('file_id', file.id)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (existing) return existing

  // The owner generates a long-lived signed URL now; anonymous visitors reuse
  // it later via the public shares row. No server code required.
  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, SHARE_TTL, { download: file.name })
  if (sErr) throw sErr

  const expiresAt = new Date(Date.now() + SHARE_TTL * 1000).toISOString()
  const { data, error } = await supabase
    .from('shares')
    .insert({
      owner_id: ownerId,
      file_id: file.id,
      file_name: file.name,
      mime_type: file.mime_type,
      size: file.size,
      signed_url: signed.signedUrl,
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getShare(token) {
  const { data, error } = await supabase
    .from('shares')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error) throw error
  return data
}

// The absolute URL a user copies to share. Uses the router basename so it works
// on GitHub Pages (/mydropbox/) and locally alike.
export function shareLink(token) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${base}/share/${token}`
}
