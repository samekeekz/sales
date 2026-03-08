"use client"

import { useState } from "react"
import { Drawer } from "vaul"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  values: string[]
  onValuesChange: (values: string[]) => void
  placeholder?: string
  allLabel?: string
  options: MultiSelectOption[]
  label?: string
  className?: string
}

function getTriggerLabel(values: string[], options: MultiSelectOption[], allLabel: string) {
  if (values.length === 0) return allLabel
  if (values.length === 1) return options.find((o) => o.value === values[0])?.label ?? values[0]
  return `${values.length} выбрано`
}

function OptionsList({
  values,
  options,
  onToggle,
}: {
  values: string[]
  options: MultiSelectOption[]
  onToggle: (value: string) => void
}) {
  return (
    <>
      {options.map((opt) => {
        const selected = values.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors",
              selected
                ? "bg-primary/8 text-primary font-medium"
                : "text-foreground hover:bg-muted active:bg-muted"
            )}
            onClick={() => onToggle(opt.value)}
          >
            <span className="truncate">{opt.label}</span>
            {selected && <CheckIcon className="h-4 w-4 shrink-0 ml-3 text-primary" />}
          </button>
        )
      })}
    </>
  )
}

export function MultiSelect({
  values,
  onValuesChange,
  placeholder = "Выберите...",
  allLabel = "Все",
  options,
  label,
  className,
}: MultiSelectProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  function toggle(value: string) {
    if (values.includes(value)) {
      onValuesChange(values.filter((v) => v !== value))
    } else {
      onValuesChange([...values, value])
    }
  }

  const triggerLabel = getTriggerLabel(values, options, allLabel)
  const hasSelection = values.length > 0

  return (
    <div className={className}>
      {/* Mobile: vaul bottom-sheet drawer */}
      <div className="sm:hidden">
        <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Drawer.Trigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-between font-normal text-sm h-9 px-3",
                hasSelection ? "text-primary border-primary/40" : "text-muted-foreground"
              )}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50 ml-2" />
            </Button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background border-t outline-none max-h-[70svh]">
              <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/25 shrink-0" />
              <div className="px-5 py-3 flex items-center justify-between shrink-0 border-b">
                <Drawer.Title className="text-base font-semibold">{label ?? placeholder}</Drawer.Title>
                {hasSelection && (
                  <button
                    type="button"
                    className="text-sm text-primary font-medium"
                    onClick={() => onValuesChange([])}
                  >
                    Сбросить
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                <OptionsList values={values} options={options} onToggle={toggle} />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>

      {/* Desktop: Popover */}
      <div className="hidden sm:block">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-between font-normal text-sm h-9 px-3",
                hasSelection ? "text-primary border-primary/40" : "text-muted-foreground"
              )}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-56" align="start">
            <div className="max-h-64 overflow-y-auto">
              <OptionsList values={values} options={options} onToggle={toggle} />
            </div>
            {hasSelection && (
              <div className="border-t px-4 py-2.5">
                <button
                  type="button"
                  className="text-xs text-primary font-medium"
                  onClick={() => onValuesChange([])}
                >
                  Сбросить выбор
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
