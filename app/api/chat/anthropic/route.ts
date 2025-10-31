import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { getBase64FromDataURL, getMediaTypeFromDataURL } from "@/lib/utils"
import { ChatSettings } from "@/types"
import Anthropic from "@anthropic-ai/sdk"
import { AnthropicStream, StreamingTextResponse } from "ai"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.anthropic_api_key, "Anthropic")

    let ANTHROPIC_FORMATTED_MESSAGES: any = messages.slice(1)

    ANTHROPIC_FORMATTED_MESSAGES = ANTHROPIC_FORMATTED_MESSAGES?.map(
      (message: any) => {
        const messageContent =
          typeof message?.content === "string"
            ? [message.content]
            : message?.content

        return {
          ...message,
          content: messageContent.map((content: any) => {
            if (typeof content === "string") {
              // Handle the case where content is a string
              return { type: "text", text: content }
            } else if (
              content?.type === "image_url" &&
              content?.image_url?.url?.length
            ) {
              return {
                type: "image",
                source: {
                  type: "base64",
                  media_type: getMediaTypeFromDataURL(content.image_url.url),
                  data: getBase64FromDataURL(content.image_url.url)
                }
              }
            } else {
              return content
            }
          })
        }
      }
    )

    const anthropic = new Anthropic({
      apiKey: profile.anthropic_api_key || ""
    })

    try {
      const response = await anthropic.messages.create({
        model: chatSettings.model,
        messages: ANTHROPIC_FORMATTED_MESSAGES,
        temperature: chatSettings.temperature,
        system: messages[0].content,
        max_tokens:
          CHAT_SETTING_LIMITS[chatSettings.model].MAX_TOKEN_OUTPUT_LENGTH,
        stream: true
      })

      try {
        const stream = AnthropicStream(response)
        return new StreamingTextResponse(stream)
      } catch (error: any) {
        console.error("Error parsing Anthropic API response:", error)
        return new NextResponse(
          JSON.stringify({
            message:
              "An error occurred while parsing the Anthropic API response"
          }),
          { status: 500 }
        )
      }
    } catch (error: any) {
      console.error("Error calling Anthropic API:", {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type,
        stack: error.stack
      })

      let errorMessage = error.message || "An error occurred while calling the Anthropic API"
      let errorCode = error.status || 500

      if (errorMessage.toLowerCase().includes("api key") || errorMessage.toLowerCase().includes("authentication") || errorCode === 401) {
        errorMessage = "Anthropic API Key is invalid. Please check your API key in settings."
        errorCode = 401
      } else if (errorMessage.toLowerCase().includes("rate limit") || errorCode === 429) {
        // Check if Anthropic provides retry-after information
        const retryAfter = error.headers?.get?.("retry-after") || error.headers?.get?.("Retry-After")
        if (retryAfter) {
          const waitSeconds = parseInt(retryAfter, 10)
          const waitMinutes = Math.ceil(waitSeconds / 60)
          errorMessage = `Rate limit exceeded. Please wait ${waitSeconds} seconds (${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}) before trying again.`
        } else {
          errorMessage = "Rate limit exceeded. Please wait 1-2 minutes before trying again."
        }
        errorCode = 429
      } else if (errorMessage.toLowerCase().includes("context") || 
                 errorMessage.toLowerCase().includes("token") ||
                 errorMessage.toLowerCase().includes("too long") ||
                 errorCode === 400) {
        // Handle 400 Bad Request errors
        if (errorMessage.toLowerCase().includes("context") || 
            errorMessage.toLowerCase().includes("token") ||
            errorMessage.toLowerCase().includes("too long")) {
          errorMessage = "Message too long. Please reduce the message length or context size."
        } else if (errorMessage.toLowerCase().includes("invalid") || 
                   errorMessage.toLowerCase().includes("format")) {
          errorMessage = "Invalid request format. Please check your message and try again."
        } else if (errorMessage.toLowerCase().includes("model") || 
                   errorMessage.toLowerCase().includes("not found")) {
          errorMessage = "Model not available or invalid. Please select a different model."
        } else {
          errorMessage = errorMessage || "Invalid request (400). Please check your message and try again."
        }
        errorCode = 400
      }

      return new NextResponse(
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
  } catch (error: any) {
    console.error("Anthropic Route Error:", {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    })

    let errorMessage = error.message || "An unexpected server error occurred"
    let errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found") || errorMessage.toLowerCase().includes("invalid api key")) {
      errorMessage = "Anthropic API Key not found or invalid. Please check your API key in settings."
      errorCode = 401
    } else if (errorCode === 401) {
      errorMessage = "Anthropic API Key is incorrect. Please fix it in your profile settings."
      errorCode = 401
    } else if (!error.message) {
      errorMessage = "An unexpected error occurred while processing your request. Please try again."
    }

    return new NextResponse(
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
