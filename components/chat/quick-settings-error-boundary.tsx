"use client"

import { Component, ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class QuickSettingsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("QuickSettings Error:", error, errorInfo)
    console.error("Error stack:", error.stack)
    console.error("Error component stack:", errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      console.error("ErrorBoundary triggered, error:", this.state.error)
      return (
        <button
          className="rounded border px-3 py-2 text-sm"
          onClick={() => {
            console.log("Retrying QuickSettings...")
            this.setState({ hasError: false, error: null })
          }}
        >
          Quick Settings (Click to retry)
        </button>
      )
    }

    return this.props.children
  }
}

