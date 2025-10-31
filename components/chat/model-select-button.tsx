import { ChatbotUIContext } from "@/context/context"
import { LLMID, ModelProvider } from "@/types"
import { IconChevronDown } from "@tabler/icons-react"
import { FC, useContext } from "react"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "../ui/dropdown-menu"
import { ModelIcon } from "../models/model-icon"
import { ModelOption } from "../models/model-option"
import { Input } from "../ui/input"
import { useRef, useState, useEffect } from "react"

interface ModelSelectButtonProps {}

export const ModelSelectButton: FC<ModelSelectButtonProps> = ({}) => {
  const contextData = useContext(ChatbotUIContext)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")

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

  if (!contextData) {
    return null
  }

  const {
    models,
    availableHostedModels,
    availableLocalModels,
    availableOpenRouterModels,
    chatSettings,
    setChatSettings
  } = contextData

  if (!chatSettings || !setChatSettings) {
    return null
  }

  const allModels = [
    ...(models || []).map(model => ({
      modelId: model.model_id as LLMID,
      modelName: model.name,
      provider: "custom" as ModelProvider,
      hostedId: model.id,
      platformLink: "",
      imageInput: false
    })),
    ...(availableHostedModels || []),
    ...(availableLocalModels || []),
    ...(availableOpenRouterModels || [])
  ]

  const groupedModels = (allModels || []).reduce<Record<string, typeof allModels>>(
    (groups, model) => {
      if (!model || !model.provider) return groups
      const key = model.provider
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(model)
      return groups
    },
    {}
  )

  const selectedModel = (allModels || []).find(
    model => model?.modelId === chatSettings.model
  )

  const handleSelectModel = (modelId: LLMID) => {
    try {
      if (setChatSettings) {
        setChatSettings({
          ...chatSettings,
          model: modelId
        })
      }
      setIsOpen(false)
    } catch (e) {
      console.error("Error selecting model:", e)
    }
  }

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
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2 text-sm">
          {selectedModel ? (
            <>
              <ModelIcon
                provider={selectedModel.provider || "custom"}
                width={20}
                height={20}
              />
              <span className="max-w-[150px] truncate">{selectedModel.modelName}</span>
            </>
          ) : (
            <span>Select Model</span>
          )}
          <IconChevronDown size={16} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="min-w-[300px] max-w-[500px] space-y-2"
        align="end"
      >
        <Input
          ref={inputRef}
          className="w-full"
          placeholder="Search models..."
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

        <div className="max-h-[400px] overflow-auto">
          {Object.entries(groupedModels || {}).map(([provider, models]) => {
            const filteredModels = (models || [])
              .filter(model => {
                if (!model || !model.provider) return false
                return true
              })
              .filter(model =>
                model?.modelName?.toLowerCase().includes(search.toLowerCase())
              )
              .sort((a, b) => (a?.provider || "").localeCompare(b?.provider || ""))

            if (filteredModels.length === 0) return null

            return (
              <div key={provider} className="mb-4">
                <div className="mb-1 ml-2 text-xs font-bold tracking-wide opacity-50">
                  {provider.toUpperCase()}
                </div>
                <div>
                  {(filteredModels || []).map(model => {
                    if (!model || !model.modelId) return null
                    return (
                      <div
                        key={model.modelId}
                        className="flex items-center space-x-1"
                        onClick={() => handleSelectModel(model.modelId)}
                      >
                        <ModelOption
                          key={model.modelId}
                          model={model}
                          onSelect={() => handleSelectModel(model.modelId)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

