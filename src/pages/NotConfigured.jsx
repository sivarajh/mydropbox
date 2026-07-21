export default function NotConfigured() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <span className="logo">📦</span>
          <h1>myDropbox</h1>
        </div>
        <div className="alert error">Supabase is not configured.</div>
        <p className="muted">
          This app needs a Supabase project to store files and accounts. Set the
          following and rebuild:
        </p>
        <ul className="muted">
          <li>
            <code>VITE_SUPABASE_URL</code>
          </li>
          <li>
            <code>VITE_SUPABASE_ANON_KEY</code>
          </li>
        </ul>
        <p className="muted">
          Locally: copy <code>.env.example</code> to <code>.env</code>. On
          GitHub Pages: add them as repository secrets (see the README).
        </p>
      </div>
    </div>
  )
}
