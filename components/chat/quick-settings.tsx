import { ChatbotUIContext } from "@/context/context"
import { getAssistantCollectionsByAssistantId } from "@/db/assistant-collections"
import { getAssistantFilesByAssistantId } from "@/db/assistant-files"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { getCollectionFilesByCollectionId } from "@/db/collection-files"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { Tables } from "@/supabase/types"
import { LLMID } from "@/types"
import { IconChevronDown, IconRobotFace } from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ModelIcon } from "../models/model-icon"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "../ui/dropdown-menu"
import { Input } from "../ui/input"
import { QuickSettingOption } from "./quick-setting-option"

interface QuickSettingsProps {}

export const QuickSettings: FC<QuickSettingsProps> = ({}) => {
  // All hooks must be called unconditionally first
  const { t } = useTranslation()
  const contextData = useContext(ChatbotUIContext)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  useHotkey("p", () => {
    try {
      setIsOpen(prevState => !prevState)
    } catch (e) {
      console.error("Hotkey error:", e)
    }
  })

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        try {
          inputRef.current?.focus()
        } catch (e) {
          // Silent fail
        }
      }, 100)
    }
  }, [isOpen])

  // Early return if context is not ready
  if (!contextData) {
    return (
      <Button variant="ghost" className="flex space-x-3 text-lg" disabled>
        Loading...
      </Button>
    )
  }

  // Safely extract all context values with defaults
  const presets = Array.isArray(contextData.presets) ? contextData.presets : []
  const assistants = Array.isArray(contextData.assistants) ? contextData.assistants : []
  const selectedAssistant = contextData.selectedAssistant || null
  const selectedPreset = contextData.selectedPreset || null
  const chatSettings = contextData.chatSettings
  const setSelectedPreset = contextData.setSelectedPreset || (() => {})
  const setSelectedAssistant = contextData.setSelectedAssistant || (() => {})
  const setChatSettings = contextData.setChatSettings || (() => {})
  const assistantImages = Array.isArray(contextData.assistantImages) ? contextData.assistantImages : []
  const setChatFiles = contextData.setChatFiles || (() => {})
  const setSelectedTools = contextData.setSelectedTools || (() => {})
  const setShowFilesDisplay = contextData.setShowFilesDisplay || (() => {})
  const selectedWorkspace = contextData.selectedWorkspace || null
  const profile = contextData.profile || null

  // Early return if chatSettings is not ready
  if (!chatSettings) {
    return (
      <Button variant="ghost" className="flex space-x-3 text-lg" disabled>
        Loading...
      </Button>
    )
  }

  const handleSelectQuickSetting = async (
    item: Tables<"presets"> | Tables<"assistants"> | null,
    contentType: "presets" | "assistants" | "remove"
  ) => {
    try {
      if (contentType === "assistants" && item) {
        setSelectedAssistant(item as Tables<"assistants">)
        setLoading(true)
        
        if (profile?.id === "guest" || profile?.user_id === "guest") {
          setSelectedTools([])
          setChatFiles([])
          setLoading(false)
          setSelectedPreset(null)
        } else {
          try {
            let allFiles: any[] = []
            const assistantFilesResponse = await getAssistantFilesByAssistantId(item.id)
            const assistantFiles = assistantFilesResponse?.files || []
            allFiles = [...assistantFiles]
            
            const assistantCollectionsResponse = await getAssistantCollectionsByAssistantId(item.id)
            const assistantCollections = assistantCollectionsResponse?.collections || []
            
            for (const collection of assistantCollections) {
              try {
                const collectionFilesResponse = await getCollectionFilesByCollectionId(collection.id)
                const collectionFiles = collectionFilesResponse?.files || []
                allFiles = [...allFiles, ...collectionFiles]
              } catch (e) {
                console.error("Error loading collection files:", e)
              }
            }
            
            const assistantToolsResponse = await getAssistantToolsByAssistantId(item.id)
            const assistantTools = assistantToolsResponse?.tools || []
            
            setSelectedTools(assistantTools)
            setChatFiles(
              allFiles.map(file => ({
                id: file.id,
                name: file.name || "",
                type: file.type || "",
                file: null
              }))
            )
            if (allFiles.length > 0) {
              setShowFilesDisplay(true)
            }
          } catch (error) {
            console.error("Error loading assistant data:", error)
            setSelectedTools([])
            setChatFiles([])
          }
          setLoading(false)
          setSelectedPreset(null)
        }
      } else if (contentType === "presets" && item) {
        setSelectedPreset(item as Tables<"presets">)
        setSelectedAssistant(null)
        setChatFiles([])
        setSelectedTools([])
      } else {
        setSelectedPreset(null)
        setSelectedAssistant(null)
        setChatFiles([])
        setSelectedTools([])
        if (selectedWorkspace && setChatSettings) {
          try {
            setChatSettings({
              model: (selectedWorkspace.default_model || "gpt-3.5-turbo") as LLMID,
              prompt: selectedWorkspace.default_prompt || "",
              temperature: selectedWorkspace.default_temperature ?? 0.7,
              contextLength: selectedWorkspace.default_context_length ?? 4096,
              includeProfileContext: selectedWorkspace.include_profile_context ?? false,
              includeWorkspaceInstructions: selectedWorkspace.include_workspace_instructions ?? false,
              embeddingsProvider: (selectedWorkspace.embeddings_provider as "openai" | "local") || "openai"
            })
          } catch (e) {
            console.error("Error setting workspace chat settings:", e)
          }
        }
        return
      }

      if (item && item.model && setChatSettings) {
        try {
          setChatSettings({
            model: item.model as LLMID,
            prompt: item.prompt || "",
            temperature: item.temperature ?? 0.7,
            contextLength: item.context_length ?? 4096,
            includeProfileContext: item.include_profile_context ?? false,
            includeWorkspaceInstructions: item.include_workspace_instructions ?? false,
            embeddingsProvider: (item.embeddings_provider as "openai" | "local") || "openai"
          })
        } catch (e) {
          console.error("Error setting chat settings from item:", e)
        }
      }
    } catch (error) {
      console.error("Error in handleSelectQuickSetting:", error)
      setLoading(false)
    }
  }

  const checkIfModified = () => {
    if (!chatSettings || (!selectedPreset && !selectedAssistant)) return false

    try {
      if (selectedPreset) {
        return (
          selectedPreset.include_profile_context !== chatSettings.includeProfileContext ||
          selectedPreset.include_workspace_instructions !== chatSettings.includeWorkspaceInstructions ||
          selectedPreset.context_length !== chatSettings.contextLength ||
          selectedPreset.model !== chatSettings.model ||
          selectedPreset.prompt !== chatSettings.prompt ||
          selectedPreset.temperature !== chatSettings.temperature
        )
      } else if (selectedAssistant) {
        return (
          selectedAssistant.include_profile_context !== chatSettings.includeProfileContext ||
          selectedAssistant.include_workspace_instructions !== chatSettings.includeWorkspaceInstructions ||
          selectedAssistant.context_length !== chatSettings.contextLength ||
          selectedAssistant.model !== chatSettings.model ||
          selectedAssistant.prompt !== chatSettings.prompt ||
          selectedAssistant.temperature !== chatSettings.temperature
        )
      }
    } catch (e) {
      console.error("Error in checkIfModified:", e)
      return false
    }

    return false
  }

  const isModified = checkIfModified()

  // Safely build items array
  const items: Array<{ contentType: "presets" | "assistants"; [key: string]: any }> = []
  
  try {
    presets.forEach(preset => {
      if (preset && typeof preset === "object") {
        items.push({ ...preset, contentType: "presets" as const })
      }
    })
  } catch (e) {
    console.error("Error processing presets:", e)
  }

  try {
    assistants.forEach(assistant => {
      if (assistant && typeof assistant === "object") {
        items.push({ ...assistant, contentType: "assistants" as const })
      }
    })
  } catch (e) {
    console.error("Error processing assistants:", e)
  }

  const selectedAssistantImage = selectedPreset
    ? ""
    : (assistantImages.find(
        image => image?.path === selectedAssistant?.image_path
      )?.base64 || "")

  const modelDetails = selectedPreset?.model
    ? LLM_LIST.find(model => model.modelId === selectedPreset.model)
    : null

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={isOpen => {
        try {
          setIsOpen(isOpen)
          setSearch("")
        } catch (e) {
          console.error("onOpenChange error:", e)
        }
      }}
    >
      <DropdownMenuTrigger asChild className="max-w-[400px]" disabled={loading}>
        <Button variant="ghost" className="flex space-x-3 text-lg">
          {selectedPreset && (
            <ModelIcon
              provider={modelDetails?.provider || "custom"}
              width={32}
              height={32}
            />
          )}

          {selectedAssistant &&
            (selectedAssistantImage ? (
              <Image
                className="rounded"
                src={selectedAssistantImage}
                alt="Assistant"
                width={28}
                height={28}
              />
            ) : (
              <IconRobotFace
                className="bg-primary text-secondary border-primary rounded border-DEFAULT p-1"
                size={28}
              />
            ))}

          {loading ? (
            <div className="animate-pulse">Loading...</div>
          ) : (
            <>
              <div className="overflow-hidden text-ellipsis">
                {isModified && (selectedPreset || selectedAssistant) && "Modified "}
                {selectedPreset?.name || selectedAssistant?.name || t("Quick Settings")}
              </div>
              <IconChevronDown className="ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="min-w-[300px] max-w-[500px] space-y-4"
        align="start"
      >
        {items.length === 0 ? (
          <div className="p-8 text-center">No items found.</div>
        ) : (
          <>
            <Input
              ref={inputRef}
              className="w-full"
              placeholder="Search..."
              value={search}
              onChange={e => {
                try {
                  setSearch(e.target.value || "")
                } catch (e) {
                  console.error("Search onChange error:", e)
                }
              }}
              onKeyDown={e => e.stopPropagation()}
            />

            {(selectedPreset || selectedAssistant) && (
              <QuickSettingOption
                contentType={selectedPreset ? "presets" : "assistants"}
                isSelected={true}
                item={(selectedPreset || selectedAssistant) as Tables<"presets"> | Tables<"assistants">}
                onSelect={() => {
                  try {
                    handleSelectQuickSetting(null, "remove")
                  } catch (e) {
                    console.error("Remove quick setting error:", e)
                  }
                }}
                image={selectedPreset ? "" : selectedAssistantImage}
              />
            )}

            {items
              .filter(item => {
                try {
                  return (
                    item &&
                    item.name &&
                    typeof item.name === "string" &&
                    item.name.toLowerCase().includes(search.toLowerCase()) &&
                    item.id !== selectedPreset?.id &&
                    item.id !== selectedAssistant?.id
                  )
                } catch (e) {
                  return false
                }
              })
              .map(({ contentType, ...item }) => {
                try {
                  if (!item || !item.id) return null
                  return (
                    <QuickSettingOption
                      key={item.id}
                      contentType={contentType as "presets" | "assistants"}
                      isSelected={false}
                      item={item as Tables<"presets"> | Tables<"assistants">}
                      onSelect={() => {
                        try {
                          handleSelectQuickSetting(
                            item as Tables<"presets"> | Tables<"assistants">,
                            contentType as "presets" | "assistants"
                          )
                        } catch (e) {
                          console.error("Select quick setting error:", e)
                        }
                      }}
                      image={
                        contentType === "assistants"
                          ? (assistantImages.find(
                              image => image?.path === (item as Tables<"assistants">).image_path
                            )?.base64 || "")
                          : ""
                      }
                    />
                  )
                } catch (e) {
                  console.error("Error rendering QuickSettingOption:", e)
                  return null
                }
              })
              .filter(Boolean)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
