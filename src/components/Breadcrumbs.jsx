import { Link } from 'react-router-dom'

export default function Breadcrumbs({ trail }) {
  return (
    <nav className="breadcrumbs" aria-label="Folder path">
      <Link to="/">My Files</Link>
      {trail.map((f) => (
        <span key={f.id}>
          <span className="sep">/</span>
          <Link to={`/folder/${f.id}`}>{f.name}</Link>
        </span>
      ))}
    </nav>
  )
}
