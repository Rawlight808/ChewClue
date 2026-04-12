import { Link } from 'react-router-dom'

const supportSrc = `${import.meta.env.BASE.replace(/\/?$/, '/')}support.html`

export function SupportPage() {
  return (
    <div className="privacy-page">
      <header className="privacy-page__header">
        <Link to="/" className="privacy-page__back">
          ← Back
        </Link>
      </header>
      <iframe className="privacy-page__frame" title="ChewClue Support" src={supportSrc} />
    </div>
  )
}
