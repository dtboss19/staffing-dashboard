import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <p>Something went wrong rendering this view. Try refreshing or changing filters.</p>
          <button
            type="button"
            className="error-boundary-retry"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
