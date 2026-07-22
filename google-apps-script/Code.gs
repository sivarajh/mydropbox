/**
 * myDropbox — Google Drive proxy (Google Apps Script Web App)
 * ---------------------------------------------------------------------------
 * A free, serverless proxy that lets the static myDropbox frontend store and
 * retrieve files in YOUR personal Google Drive. Because an Apps Script web app
 * runs *as you*, it already has access to your Drive — there is no Drive
 * refresh token or service-account key to store anywhere.
 *
 * Every write/read is gated on a valid Supabase login: the frontend passes the
 * signed-in user's Supabase access token, which this script verifies against
 * Supabase before touching Drive. That stops anyone who finds the URL from
 * uploading to (or reading from) your Drive.
 *
 * SETUP: see google-apps-script/README.md. In short — paste this into a new
 * Apps Script project, set the two Script Properties (SUPABASE_URL,
 * SUPABASE_ANON_KEY), and deploy as a Web App ("Execute as: Me",
 * "Who has access: Anyone"). Put the resulting /exec URL in VITE_PROXY_URL.
 */

var PROPS = PropertiesService.getScriptProperties();
var SUPABASE_URL = (PROPS.getProperty('SUPABASE_URL') || '').replace(/\/$/, '');
var SUPABASE_ANON_KEY = PROPS.getProperty('SUPABASE_ANON_KEY') || '';
var ROOT_FOLDER_NAME = 'myDropbox';

/**
 * All actions come in as POST with a text/plain JSON body. text/plain keeps the
 * browser request a CORS "simple request" (no preflight), which Apps Script
 * web apps require.
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (body.action) {
      case 'upload':
        return json(handleUpload(body));
      case 'download':
        return json(handleDownload(body));
      case 'delete':
        return json(handleDelete(body));
      case 'shared':
        return json(handleShared(body));
      default:
        return json({ error: 'unknown action' });
    }
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

// Simple health check so you can confirm the deployment in a browser.
function doGet() {
  return json({ ok: true, service: 'myDropbox-drive-proxy' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ---------------------------------------------------------------------------
// Auth: confirm the caller is a real, signed-in Supabase user.
// ---------------------------------------------------------------------------
function requireUser(token) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'proxy misconfigured: set SUPABASE_URL and SUPABASE_ANON_KEY in ' +
        'Project Settings > Script Properties'
    );
  }
  if (!token) throw new Error('not signed in (no token sent)');
  var res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON_KEY },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    // Surface Supabase's status so the failure is diagnosable from the response.
    throw new Error(
      'auth check failed: Supabase returned ' +
        res.getResponseCode() +
        ' — check SUPABASE_URL/ANON_KEY and that the token is valid'
    );
  }
  return JSON.parse(res.getContentText());
}

// The single Drive folder that holds every uploaded file.
function appFolder() {
  var it = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function handleUpload(body) {
  requireUser(body.token);
  var bytes = Utilities.base64Decode(body.dataBase64 || '');
  var blob = Utilities.newBlob(
    bytes,
    body.mimeType || 'application/octet-stream',
    body.name || 'file'
  );
  var file = appFolder().createFile(blob);
  return { id: file.getId(), size: file.getSize() };
}

function handleDownload(body) {
  requireUser(body.token);
  return filePayload(DriveApp.getFileById(body.id));
}

function handleDelete(body) {
  requireUser(body.token);
  var ids = body.ids || (body.id ? [body.id] : []);
  ids.forEach(function (id) {
    try {
      DriveApp.getFileById(id).setTrashed(true);
    } catch (err) {
      // Ignore files that are already gone.
    }
  });
  return { deleted: ids.length };
}

// Public: no login required, but the share token must exist and be unexpired.
// We look it up in Supabase (shares rows are world-readable by design) and only
// then serve the file — the Drive file itself never becomes publicly listable.
function handleShared(body) {
  var url =
    SUPABASE_URL +
    '/rest/v1/shares?token=eq.' +
    encodeURIComponent(body.share || '') +
    '&select=drive_id,expires_at';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    },
    muteHttpExceptions: true,
  });
  var rows = JSON.parse(res.getContentText() || '[]');
  if (!rows.length) throw new Error('invalid share');
  if (new Date(rows[0].expires_at) < new Date()) throw new Error('expired');
  return filePayload(DriveApp.getFileById(rows[0].drive_id));
}

function filePayload(file) {
  var blob = file.getBlob();
  return {
    name: file.getName(),
    mimeType: blob.getContentType(),
    dataBase64: Utilities.base64Encode(blob.getBytes()),
  };
}
