"use client"

import { useState } from "react"

export default function GuestChatPage() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([])
  const [input, setInput] = useState("")

  async function handleSend() {
    if (!input.trim()) return
    const userText = input
    setMessages(prev => [...prev, { role: "user", content: userText }])
    setInput("")

    // Fake assistant reply (no backend)
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Vous avez dit: "${userText}"` }
      ])
    }, 300)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Guest Chat</h1>
      <div className="flex-1 space-y-3 overflow-auto rounded border p-3">
        {messages.length === 0 && (
          <div className="text-muted-foreground">Commencez la conversation…</div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "text-right"
                : "text-left"
            }
          >
            <div
              className={
                "inline-block max-w-[80%] rounded px-3 py-2 " +
                (m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-secondary text-foreground")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          className="flex-1 rounded border px-3 py-2"
          placeholder="Tapez votre message…"
        />
        <button
          onClick={handleSend}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white"
        >
          Envoyer
        </button>
      </div>
    </div>
  )
}


