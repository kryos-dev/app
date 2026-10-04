import { addUTM } from "@/app/components/chat/utils"
import { ModelConfig } from "@/lib/models/types"
import { PROVIDERS } from "@/lib/providers"
import {
  ArrowSquareOutIcon,
  BrainIcon,
  GlobeIcon,
  ImageIcon,
  WrenchIcon,
} from "@phosphor-icons/react"

type SubMenuProps = {
  hoveredModelData: ModelConfig
}

export function SubMenu({ hoveredModelData }: SubMenuProps) {
  const provider = PROVIDERS.find(
    (provider) => provider.id === hoveredModelData.icon
  )

  return (
    <div className="bg-popover border-border w-70 rounded-md border p-3 shadow-md">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          {provider?.icon && <provider.icon className="size-5" />}
          <h3 className="font-medium">{hoveredModelData.name}</h3>
        </div>

        <p className="text-muted-foreground text-sm">
          {hoveredModelData.description}
        </p>

        <div className="flex flex-col gap-1">
          <div className="mt-1 flex flex-wrap gap-2">
            {hoveredModelData.vision && (
              <div className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                <ImageIcon className="size-3" />
                <span>Vision</span>
              </div>
            )}

            {hoveredModelData.tools && (
              <div className="flex items-center gap-1 rounded-full bg-chart-1/15 px-2 py-0.5 text-xs text-chart-1">
                <WrenchIcon className="size-3" />
                <span>Tools</span>
              </div>
            )}

            {hoveredModelData.reasoning && (
              <div className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                <BrainIcon className="size-3" />
                <span>Reasoning</span>
              </div>
            )}

            {hoveredModelData.webSearch && (
              <div className="flex items-center gap-1 rounded-full bg-chart-3/15 px-2 py-0.5 text-xs text-chart-3">
                <GlobeIcon className="size-3" />
                <span>Web Search</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {!!hoveredModelData.contextWindow && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">Context</span>
              <span>
                {Intl.NumberFormat("fr-FR", {
                  style: "decimal",
                }).format(hoveredModelData.contextWindow)}{" "}
                tokens
              </span>
            </div>
          )}

          {(!!hoveredModelData.inputCost || !!hoveredModelData.outputCost) && (
            <div className="flex flex-col gap-2">
              {!!hoveredModelData.inputCost && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">Input Pricing</span>
                  <span>
                    {Intl.NumberFormat("ja-JP", {
                      style: "currency",
                      currency: "USD",
                    }).format(hoveredModelData.inputCost)}{" "}
                    / 1M tokens
                  </span>
                </div>
              )}

              {!!hoveredModelData.outputCost && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">Output Pricing</span>
                  <span>
                    {Intl.NumberFormat("ja-JP", {
                      style: "currency",
                      currency: "USD",
                    }).format(hoveredModelData.outputCost)}{" "}
                    / 1M tokens
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Provider</span>
            <span>{hoveredModelData.provider}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex-1 font-medium">Id</span>
            <span className="text-muted-foreground truncate text-xs">
              {String(hoveredModelData.id)}
            </span>
          </div>

          {(hoveredModelData.apiDocs || hoveredModelData.modelPage) && (
            <div className="mt-4 flex items-center justify-between gap-2 text-xs">
              {hoveredModelData.apiDocs && (
                <a
                  href={addUTM(hoveredModelData.apiDocs)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5"
                >
                  <span className="">API Docs</span>
                  <ArrowSquareOutIcon className="size-3" />
                </a>
              )}
              {hoveredModelData.modelPage && (
                <a
                  href={addUTM(hoveredModelData.modelPage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5"
                >
                  <span className="">Model Page</span>
                  <ArrowSquareOutIcon className="size-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
