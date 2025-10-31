// Only used in use-chat-handler.tsx to keep it clean

import { createChatFiles } from "@/db/chat-files"
import { createChat } from "@/db/chats"
import { createMessageFileItems } from "@/db/message-file-items"
import { createMessages, updateMessage } from "@/db/messages"
import { uploadMessageImage } from "@/db/storage/message-images"
import {
  buildFinalMessages,
  adaptMessagesForGoogleGemini
} from "@/lib/build-prompt"
import { consumeReadableStream } from "@/lib/consume-stream"
import { Tables, TablesInsert } from "@/supabase/types"
import {
  ChatFile,
  ChatMessage,
  ChatPayload,
  ChatSettings,
  LLM,
  MessageImage
} from "@/types"
import React from "react"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"

export const validateChatSettings = (
  chatSettings: ChatSettings | null,
  modelData: LLM | undefined,
  profile: Tables<"profiles"> | null,
  selectedWorkspace: Tables<"workspaces"> | null,
  messageContent: string
) => {
  if (!chatSettings) {
    throw new Error("Chat settings not found")
  }

  if (!modelData) {
    throw new Error("Model not found")
  }

  if (!profile) {
    throw new Error("Profile not found")
  }

  if (!selectedWorkspace) {
    throw new Error("Workspace not found")
  }

  if (!messageContent) {
    throw new Error("Message content not found")
  }
}

export const handleRetrieval = async (
  userInput: string,
  newMessageFiles: ChatFile[],
  chatFiles: ChatFile[],
  embeddingsProvider: "openai" | "local",
  sourceCount: number
) => {
  const response = await fetch("/api/retrieval/retrieve", {
    method: "POST",
    body: JSON.stringify({
      userInput,
      fileIds: [...newMessageFiles, ...chatFiles].map(file => file.id),
      embeddingsProvider,
      sourceCount
    })
  })

  if (!response.ok) {
    console.error("Error retrieving:", response)
  }

  const { results } = (await response.json()) as {
    results: Tables<"file_items">[]
  }

  return results
}

export const createTempMessages = (
  messageContent: string,
  chatMessages: ChatMessage[],
  chatSettings: ChatSettings,
  b64Images: string[],
  isRegeneration: boolean,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  selectedAssistant: Tables<"assistants"> | null
) => {
  let tempUserChatMessage: ChatMessage = {
    message: {
      chat_id: "",
      assistant_id: null,
      content: messageContent,
      created_at: "",
      id: uuidv4(),
      image_paths: b64Images,
      model: chatSettings.model,
      role: "user",
      sequence_number: chatMessages.length,
      updated_at: "",
      user_id: ""
    },
    fileItems: []
  }

  let tempAssistantChatMessage: ChatMessage = {
    message: {
      chat_id: "",
      assistant_id: selectedAssistant?.id || null,
      content: "",
      created_at: "",
      id: uuidv4(),
      image_paths: [],
      model: chatSettings.model,
      role: "assistant",
      sequence_number: chatMessages.length + 1,
      updated_at: "",
      user_id: ""
    },
    fileItems: []
  }

  let newMessages = []

  if (isRegeneration) {
    const lastMessageIndex = chatMessages.length - 1
    chatMessages[lastMessageIndex].message.content = ""
    newMessages = [...chatMessages]
  } else {
    newMessages = [
      ...chatMessages,
      tempUserChatMessage,
      tempAssistantChatMessage
    ]
  }

  setChatMessages(newMessages)

  return {
    tempUserChatMessage,
    tempAssistantChatMessage
  }
}

export const handleLocalChat = async (
  payload: ChatPayload,
  profile: Tables<"profiles">,
  chatSettings: ChatSettings,
  tempAssistantMessage: ChatMessage,
  isRegeneration: boolean,
  newAbortController: AbortController,
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
) => {
  const formattedMessages = await buildFinalMessages(payload, profile, [])

  // Ollama API: https://github.com/jmorganca/ollama/blob/main/docs/api.md
  const response = await fetchChatResponse(
    process.env.NEXT_PUBLIC_OLLAMA_URL + "/api/chat",
    {
      model: chatSettings.model,
      messages: formattedMessages,
      options: {
        temperature: payload.chatSettings.temperature
      }
    },
    false,
    newAbortController,
    setIsGenerating,
    setChatMessages
  )

  return await processResponse(
    response,
    isRegeneration
      ? payload.chatMessages[payload.chatMessages.length - 1]
      : tempAssistantMessage,
    false,
    newAbortController,
    setFirstTokenReceived,
    setChatMessages,
    setToolInUse
  )
}

export const handleHostedChat = async (
  payload: ChatPayload,
  profile: Tables<"profiles">,
  modelData: LLM,
  tempAssistantChatMessage: ChatMessage,
  isRegeneration: boolean,
  newAbortController: AbortController,
  newMessageImages: MessageImage[],
  chatImages: MessageImage[],
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
) => {
  const provider =
    modelData.provider === "openai" && profile.use_azure_openai
      ? "azure"
      : modelData.provider

  let draftMessages = await buildFinalMessages(payload, profile, chatImages)

  let formattedMessages : any[] = []
  if (provider === "google") {
    formattedMessages = await adaptMessagesForGoogleGemini(payload, draftMessages)
  } else {
    formattedMessages = draftMessages
  }

  const apiEndpoint =
    provider === "custom" ? "/api/chat/custom" : `/api/chat/${provider}`

  const requestBody = {
    chatSettings: payload.chatSettings,
    messages: formattedMessages,
    customModelId: provider === "custom" ? modelData.hostedId : ""
  }

  const response = await fetchChatResponse(
    apiEndpoint,
    requestBody,
    true,
    newAbortController,
    setIsGenerating,
    setChatMessages
  )

  return await processResponse(
    response,
    isRegeneration
      ? payload.chatMessages[payload.chatMessages.length - 1]
      : tempAssistantChatMessage,
    true,
    newAbortController,
    setFirstTokenReceived,
    setChatMessages,
    setToolInUse
  )
}

export const fetchChatResponse = async (
  url: string,
  body: object,
  isHosted: boolean,
  controller: AbortController,
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) => {
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    signal: controller.signal
  })

  if (!response.ok) {
    // Clone the response before reading it to avoid locking the stream
    const clonedResponse = response.clone()
    
    if (response.status === 404) {
      if (!isHosted) {
        // Ollama (local) model not found
      toast.error(
          "Model not found. Make sure you have it downloaded via Ollama.",
          {
            duration: 5000,
            description: `Try: ollama pull <model-name>`
          }
        )
      } else {
        // Hosted API endpoint not found
        try {
          const errorData = await clonedResponse.json()
          let errorMessage = errorData.message || "API endpoint not found"
          
          // Provide more helpful messages based on the endpoint
          if (url.includes("/api/chat/openai")) {
            errorMessage = "OpenAI endpoint not found. The model may not be available or the API route may be missing."
          } else if (url.includes("/api/chat/anthropic")) {
            errorMessage = "Anthropic endpoint not found. The model may not be available or the API route may be missing."
          } else if (url.includes("/api/chat/custom")) {
            errorMessage = "Custom model endpoint not found. Please check your custom model configuration."
          } else {
            errorMessage = `API endpoint not found (404): ${url}`
          }
          
          toast.error(errorMessage, {
            duration: 5000,
            description: "This usually means the model or API endpoint doesn't exist."
          })
        } catch {
          let endpointName = url.split("/").pop() || "API endpoint"
          toast.error(`${endpointName} not found (404)`, {
            duration: 5000,
            description: "The requested endpoint doesn't exist. Please check your model selection."
          })
        }
      }
    } else if (response.status === 429) {
      // Rate limit error
      try {
        const errorData = await clonedResponse.json()
        let errorMessage = errorData.message || "Rate limit exceeded"
        
        // Try to get Retry-After header for wait time
        const retryAfter = response.headers.get("Retry-After") || response.headers.get("retry-after")
        const waitTime = retryAfter ? parseInt(retryAfter, 10) : 120 // Default to 2 minutes if not provided
        
        // Provide more helpful message with wait time if available
        if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
          if (retryAfter) {
            const minutes = Math.ceil(waitTime / 60)
            const seconds = waitTime % 60
            errorMessage = `Rate limit exceeded. Please wait ${waitTime} seconds (${minutes} minute${minutes > 1 ? 's' : ''}${seconds > 0 ? ` and ${seconds} second${seconds > 1 ? 's' : ''}` : ''}) before trying again.`
          } else {
            errorMessage = "Rate limit exceeded. Please wait 1-2 minutes before trying again. Your API provider has rate limits to prevent abuse."
          }
        }
        
        // Calculate recommended wait time (default 2 minutes if not specified)
        const recommendedWaitSeconds = retryAfter ? waitTime : 120
        const recommendedWaitMinutes = Math.ceil(recommendedWaitSeconds / 60)
        
        toast.error(errorMessage, {
          duration: 10000, // Show for 10 seconds to allow reading
          description: retryAfter 
            ? `⏱️ Wait ${recommendedWaitMinutes} minute(s) (${recommendedWaitSeconds} seconds) before retrying. You've hit the rate limit for your API plan.` 
            : "⏱️ This usually happens when you've made too many requests in a short time. Wait 1-2 minutes before retrying. Consider upgrading your API plan for higher limits."
        })
      } catch {
        const retryAfter = response.headers.get("Retry-After") || response.headers.get("retry-after")
        const waitTime = retryAfter ? parseInt(retryAfter, 10) : 120
        
        let errorMessage = "Rate limit exceeded. Please wait a moment and try again."
        if (retryAfter) {
          const minutes = Math.ceil(waitTime / 60)
          const seconds = waitTime % 60
          errorMessage = `Rate limit exceeded. Please wait ${waitTime} seconds (${minutes} minute${minutes > 1 ? 's' : ''}${seconds > 0 ? ` and ${seconds} second${seconds > 1 ? 's' : ''}` : ''}) before trying again.`
        }
        
        const recommendedWaitSeconds = retryAfter ? waitTime : 120
        const recommendedWaitMinutes = Math.ceil(recommendedWaitSeconds / 60)
        
        toast.error(errorMessage, {
          duration: 10000,
          description: retryAfter 
            ? `⏱️ Wait ${recommendedWaitMinutes} minute(s) (${recommendedWaitSeconds} seconds) before retrying.` 
            : "⏱️ Wait 1-2 minutes before retrying. Check your API provider's rate limit documentation."
        })
      }
    } else if (response.status === 400) {
      // Bad Request - invalid input
      try {
        const errorData = await clonedResponse.json()
        let errorMessage = errorData.message || "Invalid request"
        
        // Provide more helpful messages based on common 400 errors
        if (errorMessage.toLowerCase().includes("context length") || 
            errorMessage.toLowerCase().includes("token") ||
            errorMessage.toLowerCase().includes("too long")) {
          errorMessage = "Message too long. Please reduce the message length or context size."
        } else if (errorMessage.toLowerCase().includes("invalid") || 
                   errorMessage.toLowerCase().includes("format")) {
          errorMessage = "Invalid request format. Please check your message and try again."
        } else if (errorMessage.toLowerCase().includes("model") || 
                   errorMessage.toLowerCase().includes("not found")) {
          errorMessage = "Model not available or invalid. Please select a different model."
        } else if (errorMessage.toLowerCase().includes("parameter") ||
                   errorMessage.toLowerCase().includes("missing")) {
          errorMessage = "Missing or invalid parameters. Please try again."
        }
        
        toast.error(errorMessage, {
          duration: 8000,
          description: errorData.message 
            ? `Error details: ${errorData.message}` 
            : "This usually happens when the request format is invalid or the message is too long."
        })
      } catch {
        toast.error("Invalid request (400). Please check your message and try again.", {
          duration: 8000,
          description: "The request format might be invalid or the message might be too long."
        })
      }
    } else if (response.status === 401) {
      // Unauthorized - API key issue
      try {
        const errorData = await clonedResponse.json()
        toast.error(errorData.message || "Invalid API key. Please check your API keys in settings.")
      } catch {
        toast.error("Invalid API key. Please check your API keys in settings.")
      }
    } else if (response.status === 500 || response.status === 502 || response.status === 503) {
      // Server errors
      try {
        const errorData = await clonedResponse.json()
        toast.error(errorData.message || `Server error (${response.status}). Please try again later.`)
      } catch {
        toast.error(`Server error (${response.status}). Please try again later.`)
      }
    } else {
      try {
        const errorData = await clonedResponse.json()
        toast.error(errorData.message || `Error: ${response.status}`)
      } catch {
        toast.error(`Error: ${response.status}`)
      }
    }

    setIsGenerating(false)
    setChatMessages(prevMessages => prevMessages.slice(0, -2))
    
    // Throw an error to prevent processResponse from being called
    throw new Error(`Request failed with status ${response.status}`)
  }

  return response
}

export const processResponse = async (
  response: Response,
  lastChatMessage: ChatMessage,
  isHosted: boolean,
  controller: AbortController,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
) => {
  let fullText = ""
  let contentToAdd = ""

  if (!response.body) {
    throw new Error("Response body is null")
  }

  // Check if body is already locked
  if (response.body.locked) {
    throw new Error("Response body stream is already locked to a reader")
  }

  try {
    await consumeReadableStream(
      response.body,
      chunk => {
        setFirstTokenReceived(true)
        setToolInUse("none")

        try {
          contentToAdd = isHosted
            ? chunk
            : // Ollama's streaming endpoint returns new-line separated JSON
              // objects. A chunk may have more than one of these objects, so we
              // need to split the chunk by new-lines and handle each one
              // separately.
              chunk
                .trimEnd()
                .split("\n")
                .reduce(
                  (acc, line) => acc + JSON.parse(line).message.content,
                  ""
                )
          fullText += contentToAdd
        } catch (error) {
          console.error("Error parsing JSON:", error)
        }

        setChatMessages(prev =>
          prev.map(chatMessage => {
            if (chatMessage.message.id === lastChatMessage.message.id) {
              const updatedChatMessage: ChatMessage = {
                message: {
                  ...chatMessage.message,
                  content: fullText
                },
                fileItems: chatMessage.fileItems
              }

              return updatedChatMessage
            }

            return chatMessage
          })
        )
      },
      controller.signal
    )

    return fullText
  } catch (error: any) {
    console.error("Error in processResponse:", error)
    
    // If stream is locked, provide a more helpful error message
    if (error?.message?.includes("locked")) {
      throw new Error("Stream is already in use. Please try again.")
    }
    
    throw error
  }
}

export const handleCreateChat = async (
  chatSettings: ChatSettings,
  profile: Tables<"profiles">,
  selectedWorkspace: Tables<"workspaces">,
  messageContent: string,
  selectedAssistant: Tables<"assistants"> | null,
  newMessageFiles: ChatFile[],
  setSelectedChat: React.Dispatch<React.SetStateAction<Tables<"chats"> | null>>,
  setChats: React.Dispatch<React.SetStateAction<Tables<"chats">[]>>,
  setChatFiles: React.Dispatch<React.SetStateAction<ChatFile[]>>
) => {
  // No-auth mode: create chat in memory
  if (profile.id === "guest" || profile.user_id === "guest") {
    const createdChat = {
      id: uuidv4(),
      user_id: profile.user_id,
      workspace_id: selectedWorkspace.id,
      assistant_id: selectedAssistant?.id || null,
      context_length: chatSettings.contextLength,
      include_profile_context: chatSettings.includeProfileContext,
      include_workspace_instructions: chatSettings.includeWorkspaceInstructions,
      model: chatSettings.model,
      name: messageContent.substring(0, 100),
      prompt: chatSettings.prompt,
      temperature: chatSettings.temperature,
      embeddings_provider: chatSettings.embeddingsProvider,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Tables<"chats">

    setSelectedChat(createdChat)
    setChats(chats => [createdChat, ...chats])
    setChatFiles(prev => [...prev, ...newMessageFiles])

    return createdChat
  }

  // Auth mode: use database
  const createdChat = await createChat({
    user_id: profile.user_id,
    workspace_id: selectedWorkspace.id,
    assistant_id: selectedAssistant?.id || null,
    context_length: chatSettings.contextLength,
    include_profile_context: chatSettings.includeProfileContext,
    include_workspace_instructions: chatSettings.includeWorkspaceInstructions,
    model: chatSettings.model,
    name: messageContent.substring(0, 100),
    prompt: chatSettings.prompt,
    temperature: chatSettings.temperature,
    embeddings_provider: chatSettings.embeddingsProvider
  })

  setSelectedChat(createdChat)
  setChats(chats => [createdChat, ...chats])

  await createChatFiles(
    newMessageFiles.map(file => ({
      user_id: profile.user_id,
      chat_id: createdChat.id,
      file_id: file.id
    }))
  )

  setChatFiles(prev => [...prev, ...newMessageFiles])

  return createdChat
}

export const handleCreateMessages = async (
  chatMessages: ChatMessage[],
  currentChat: Tables<"chats">,
  profile: Tables<"profiles">,
  modelData: LLM,
  messageContent: string,
  generatedText: string,
  newMessageImages: MessageImage[],
  isRegeneration: boolean,
  retrievedFileItems: Tables<"file_items">[],
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setChatFileItems: React.Dispatch<
    React.SetStateAction<Tables<"file_items">[]>
  >,
  setChatImages: React.Dispatch<React.SetStateAction<MessageImage[]>>,
  selectedAssistant: Tables<"assistants"> | null
) => {
  // No-auth mode: create messages in memory
  if (profile.id === "guest" || profile.user_id === "guest") {
    let finalChatMessages: ChatMessage[] = []

    if (isRegeneration) {
      const updatedMessage = {
        ...chatMessages[chatMessages.length - 1].message,
        content: generatedText
      }

      finalChatMessages = [
        ...chatMessages.slice(0, -1),
        {
          message: updatedMessage,
          fileItems: []
        }
      ]
    } else {
      const userMessage = {
        chat_id: currentChat.id,
        assistant_id: null,
        user_id: profile.user_id,
        content: messageContent,
        model: modelData.modelId,
        role: "user" as const,
        sequence_number: chatMessages.length,
        image_paths: [],
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const assistantMessage = {
        chat_id: currentChat.id,
        assistant_id: selectedAssistant?.id || null,
        user_id: profile.user_id,
        content: generatedText,
        model: modelData.modelId,
        role: "assistant" as const,
        sequence_number: chatMessages.length + 1,
        image_paths: [],
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      finalChatMessages = [
        ...chatMessages,
        {
          message: userMessage,
          fileItems: []
        },
        {
          message: assistantMessage,
          fileItems: retrievedFileItems.map(fileItem => fileItem.id)
        }
      ]

      setChatFileItems(prevFileItems => {
        const newFileItems = retrievedFileItems.filter(
          fileItem => !prevFileItems.some(prevItem => prevItem.id === fileItem.id)
        )
        return [...prevFileItems, ...newFileItems]
      })
    }

    setChatMessages(finalChatMessages)
    return
  }

  // Auth mode: use database
  const finalUserMessage: TablesInsert<"messages"> = {
    chat_id: currentChat.id,
    assistant_id: null,
    user_id: profile.user_id,
    content: messageContent,
    model: modelData.modelId,
    role: "user",
    sequence_number: chatMessages.length,
    image_paths: []
  }

  const finalAssistantMessage: TablesInsert<"messages"> = {
    chat_id: currentChat.id,
    assistant_id: selectedAssistant?.id || null,
    user_id: profile.user_id,
    content: generatedText,
    model: modelData.modelId,
    role: "assistant",
    sequence_number: chatMessages.length + 1,
    image_paths: []
  }

  let finalChatMessages: ChatMessage[] = []

  if (isRegeneration) {
    const lastStartingMessage = chatMessages[chatMessages.length - 1].message

    const updatedMessage = await updateMessage(lastStartingMessage.id, {
      ...lastStartingMessage,
      content: generatedText
    })

    chatMessages[chatMessages.length - 1].message = updatedMessage

    finalChatMessages = [...chatMessages]

    setChatMessages(finalChatMessages)
  } else {
    const createdMessages = await createMessages([
      finalUserMessage,
      finalAssistantMessage
    ])

    // Upload each image (stored in newMessageImages) for the user message to message_images bucket
    const uploadPromises = newMessageImages
      .filter(obj => obj.file !== null)
      .map(obj => {
        let filePath = `${profile.user_id}/${currentChat.id}/${
          createdMessages[0].id
        }/${uuidv4()}`

        return uploadMessageImage(filePath, obj.file as File).catch(error => {
          console.error(`Failed to upload image at ${filePath}:`, error)
          return null
        })
      })

    const paths = (await Promise.all(uploadPromises)).filter(
      Boolean
    ) as string[]

    setChatImages(prevImages => [
      ...prevImages,
      ...newMessageImages.map((obj, index) => ({
        ...obj,
        messageId: createdMessages[0].id,
        path: paths[index]
      }))
    ])

    const updatedMessage = await updateMessage(createdMessages[0].id, {
      ...createdMessages[0],
      image_paths: paths
    })

    const createdMessageFileItems = await createMessageFileItems(
      retrievedFileItems.map(fileItem => {
        return {
          user_id: profile.user_id,
          message_id: createdMessages[1].id,
          file_item_id: fileItem.id
        }
      })
    )

    finalChatMessages = [
      ...chatMessages,
      {
        message: updatedMessage,
        fileItems: []
      },
      {
        message: createdMessages[1],
        fileItems: retrievedFileItems.map(fileItem => fileItem.id)
      }
    ]

    setChatFileItems(prevFileItems => {
      const newFileItems = retrievedFileItems.filter(
        fileItem => !prevFileItems.some(prevItem => prevItem.id === fileItem.id)
      )

      return [...prevFileItems, ...newFileItems]
    })

    setChatMessages(finalChatMessages)
  }
}
