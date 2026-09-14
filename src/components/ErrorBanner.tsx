import { FC } from 'react'

interface ErrorBannerProps {
  message: string | null
  onDismiss: () => void
}

/** The one place anything gone wrong in the store becomes visible. */
const ErrorBanner: FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  if (message === null) return null

  return (
    <div className="error-banner" role="alert">
      <span className="error-banner-text">{message}</span>
      <button
        type="button"
        className="error-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export default ErrorBanner
