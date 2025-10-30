"use client"

import Link from "next/link"

export default function RootLanding() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Chatbot UI</h1>
        <p className="text-muted-foreground">Welcome. Continue to the app.</p>
        <Link
          href="/en/chat"
          className="inline-block rounded bg-blue-600 px-4 py-2 font-semibold text-white"
        >
          Enter
        </Link>
      </div>
    </main>
  )
}


