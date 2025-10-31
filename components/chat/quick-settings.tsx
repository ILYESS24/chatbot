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
          console.error("Focus error:", e)
        }
      }, 100)
    }
  }, [isOpen])

  if (!contextData) {
    return (
      <Button variant="ghost" className="flex space-x-3 text-lg" disabled>
        Loading...
      </Button>
    )
  }

  const {
    presets,
    assistants,
    selectedAssistant,
    selectedPreset,
    chatSettings,
    setSelectedPreset,
    setSelectedAssistant,
    setChatSettings,
    assistantImages,
    setChatFiles,
    setSelectedTools,
    setShowFilesDisplay,
    selectedWorkspace,
    profile
  } = contextData

  const handleSelectQuickSetting = async (
    item: Tables<"presets"> | Tables<"assistants"> | null,
    contentType: "presets" | "assistants" | "remove"
  ) => {
    try {
      if (contentType === "assistants" && item) {
        setSelectedAssistant?.(item as Tables<"assistants">)
        setLoading(true)
        
        // Skip DB calls in no-auth mode
        if (profile?.id === "guest" || profile?.user_id === "guest") {
          setSelectedTools?.([])
          setChatFiles?.([])
          setLoading(false)
          setSelectedPreset?.(null)
        } else {
          try {
            let allFiles = []
            const assistantFiles = (await getAssistantFilesByAssistantId(item.id))
              .files
            allFiles = [...assistantFiles]
            const assistantCollections = (
              await getAssistantCollectionsByAssistantId(item.id)
            ).collections
            for (const collection of assistantCollections) {
              const collectionFiles = (
                await getCollectionFilesByCollectionId(collection.id)
              ).files
              allFiles = [...allFiles, ...collectionFiles]
            }
            const assistantTools = (await getAssistantToolsByAssistantId(item.id))
              .tools
            setSelectedTools?.(assistantTools)
            setChatFiles?.(
              allFiles.map(file => ({
                id: file.id,
                name: file.name,
                type: file.type,
                file: null
              }))
            )
            if (allFiles.length > 0) setShowFilesDisplay?.(true)
          } catch (error) {
            console.error("Error loading assistant data:", error)
            setSelectedTools?.([])
            setChatFiles?.([])
          }
          setLoading(false)
          setSelectedPreset?.(null)
        }
      } else if (contentType === "presets" && item) {
        setSelectedPreset?.(item as Tables<"presets">)
        setSelectedAssistant?.(null)
        setChatFiles?.([])
        setSelectedTools?.([])
      } else {
        setSelectedPreset?.(null)
        setSelectedAssistant?.(null)
        setChatFiles?.([])
        setSelectedTools?.([])
        if (selectedWorkspace) {
          setChatSettings?.({
            model: selectedWorkspace.default_model as LLMID,
            prompt: selectedWorkspace.default_prompt || "",
            temperature: selectedWorkspace.default_temperature ?? 0.7,
            contextLength: selectedWorkspace.default_context_length ?? 4096,
            includeProfileContext: selectedWorkspace.include_profile_context ?? false,
            includeWorkspaceInstructions:
              selectedWorkspace.include_workspace_instructions ?? false,
            embeddingsProvider: (selectedWorkspace.embeddings_provider as
              | "openai"
              | "local") || "openai"
          })
        }
        return
      }

      if (item && item.model) {
        setChatSettings?.({
          model: item.model as LLMID,
          prompt: item.prompt || "",
          temperature: item.temperature ?? 0.7,
          contextLength: item.context_length ?? 4096,
          includeProfileContext: item.include_profile_context ?? false,
          includeWorkspaceInstructions: item.include_workspace_instructions ?? false,
          embeddingsProvider: (item.embeddings_provider as "openai" | "local") || "openai"
        })
      }
    } catch (error) {
      console.error("Error in handleSelectQuickSetting:", error)
      setLoading(false)
    }
  }

  const checkIfModified = () => {
    if (!chatSettings || (!selectedPreset && !selectedAssistant)) return false

    if (selectedPreset) {
      return (
        selectedPreset.include_profile_context !==
          chatSettings?.includeProfileContext ||
        selectedPreset.include_workspace_instructions !==
          chatSettings.includeWorkspaceInstructions ||
        selectedPreset.context_length !== chatSettings.contextLength ||
        selectedPreset.model !== chatSettings.model ||
        selectedPreset.prompt !== chatSettings.prompt ||
        selectedPreset.temperature !== chatSettings.temperature
      )
    } else if (selectedAssistant) {
      return (
        selectedAssistant.include_profile_context !==
          chatSettings.includeProfileContext ||
        selectedAssistant.include_workspace_instructions !==
          chatSettings.includeWorkspaceInstructions ||
        selectedAssistant.context_length !== chatSettings.contextLength ||
        selectedAssistant.model !== chatSettings.model ||
        selectedAssistant.prompt !== chatSettings.prompt ||
        selectedAssistant.temperature !== chatSettings.temperature
      )
    }

    return false
  }

  const isModified = checkIfModified()

  const items = [
    ...(presets || []).map(preset => ({ ...preset, contentType: "presets" as const })),
    ...(assistants || []).map(assistant => ({
      ...assistant,
      contentType: "assistants" as const
    }))
  ]

  const selectedAssistantImage = selectedPreset
    ? ""
    : (assistantImages || []).find(
        image => image.path === selectedAssistant?.image_path
      )?.base64 || ""

  const modelDetails = selectedPreset?.model
    ? LLM_LIST.find(model => model.modelId === selectedPreset.model)
    : null

  // Early return if critical data is missing
  if (!chatSettings) {
    return (
      <Button variant="ghost" className="flex space-x-3 text-lg" disabled>
        Loading...
      </Button>
    )
  }

  // Remove ErrorBoundary temporarily to see the real error
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
              <div className="animate-pulse">Loading assistant...</div>
            ) : (
              <>
                <div className="overflow-hidden text-ellipsis">
                  {isModified &&
                    (selectedPreset || selectedAssistant) &&
                    "Modified "}

                  {selectedPreset?.name ||
                    selectedAssistant?.name ||
                    t("Quick Settings")}
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
          {(presets || []).length === 0 && (assistants || []).length === 0 ? (
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
                    setSearch(e.target.value)
                  } catch (e) {
                    console.error("Search onChange error:", e)
                  }
                }}
                onKeyDown={e => e.stopPropagation()}
              />

              {(selectedPreset || selectedAssistant) ? (
                <QuickSettingOption
                  contentType={selectedPreset ? "presets" : "assistants"}
                  isSelected={true}
                  item={
                    (selectedPreset ||
                      selectedAssistant) as
                      | Tables<"presets">
                      | Tables<"assistants">
                  }
                  onSelect={() => {
                    try {
                      handleSelectQuickSetting(null, "remove")
                    } catch (e) {
                      console.error("Remove quick setting error:", e)
                    }
                  }}
                  image={selectedPreset ? "" : selectedAssistantImage}
                />
              ) : null}

              {items
                .filter(
                  item =>
                    item &&
                    item.name &&
                    item.name.toLowerCase().includes(search.toLowerCase()) &&
                    item.id !== selectedPreset?.id &&
                    item.id !== selectedAssistant?.id
                )
                .map(({ contentType, ...item }) => {
                  if (!item || !item.id) return null
                  return (
                    <QuickSettingOption
                      key={item.id}
                      contentType={contentType as "presets" | "assistants"}
                      isSelected={false}
                      item={item}
                      onSelect={() => {
                        try {
                          handleSelectQuickSetting(
                            item,
                            contentType as "presets" | "assistants"
                          )
                        } catch (e) {
                          console.error("Select quick setting error:", e)
                        }
                      }}
                      image={
                        contentType === "assistants"
                          ? (assistantImages || []).find(
                              image =>
                                image.path ===
                                (item as Tables<"assistants">).image_path
                            )?.base64 || ""
                          : ""
                      }
                    />
                  )
                })
                .filter(Boolean)}
            </>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
