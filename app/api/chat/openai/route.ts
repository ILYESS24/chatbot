import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const response = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages: messages as ChatCompletionCreateParamsBase["messages"],
      temperature: chatSettings.temperature,
      max_tokens:
        chatSettings.model === "gpt-4-vision-preview" ||
        chatSettings.model === "gpt-4o"
          ? 4096
          : null, // TODO: Fix
      stream: true
    })

    const stream = OpenAIStream(response as any)

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    console.error("OpenAI API Error:", {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    })

    let errorMessage = error.message || "An unexpected server error occurred"
    let errorCode = error.status || 500

    // Handle specific OpenAI API errors
    if (errorMessage.toLowerCase().includes("api key not found") || errorMessage.toLowerCase().includes("invalid api key")) {
      errorMessage = "OpenAI API Key not found or invalid. Please check your API key in settings."
      errorCode = 401
    } else if (errorMessage.toLowerCase().includes("incorrect api key") || errorCode === 401) {
      errorMessage = "OpenAI API Key is incorrect. Please fix it in your profile settings."
      errorCode = 401
    } else if (errorMessage.toLowerCase().includes("rate limit") || errorCode === 429) {
      // Check if OpenAI provides retry-after information
      const retryAfter = error.headers?.get?.("retry-after") || error.headers?.get?.("Retry-After")
      if (retryAfter) {
        const waitSeconds = parseInt(retryAfter, 10)
        const waitMinutes = Math.ceil(waitSeconds / 60)
        errorMessage = `Rate limit exceeded. Please wait ${waitSeconds} seconds (${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}) before trying again.`
      } else {
        errorMessage = "Rate limit exceeded. Please wait 1-2 minutes before trying again."
      }
      errorCode = 429
    } else if (errorMessage.toLowerCase().includes("context length") || errorCode === 400) {
      errorMessage = "Message too long. Please reduce the message length or context size."
      errorCode = 400
    } else if (!error.message) {
      errorMessage = "An unexpected error occurred while processing your request. Please try again."
    }

    return new Response(
      JSON.stringify({ 
        message: errorMessage,
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      }),
      {
        status: errorCode,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
