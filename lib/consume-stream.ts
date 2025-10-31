export async function consumeReadableStream(
  stream: ReadableStream<Uint8Array>,
  callback: (chunk: string) => void,
  signal: AbortSignal
): Promise<void> {
  // Check if stream is already locked
  if (stream.locked) {
    console.error("Stream is already locked, cannot create new reader")
    throw new Error("ReadableStream is already locked to a reader")
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()

  signal.addEventListener("abort", () => {
    try {
      reader.cancel()
    } catch (e) {
      // Reader may already be released
      console.error("Error cancelling reader:", e)
    }
  }, { once: true })

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      if (value) {
        callback(decoder.decode(value, { stream: true }))
      }
    }
  } catch (error) {
    if (signal.aborted) {
      console.error("Stream reading was aborted:", error)
    } else {
      console.error("Error consuming stream:", error)
      throw error // Re-throw to propagate the error
    }
  } finally {
    try {
      reader.releaseLock()
    } catch (e) {
      // Lock may already be released
      console.error("Error releasing lock:", e)
    }
  }
}
