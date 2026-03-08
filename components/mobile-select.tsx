"use client"

import { useState } from "react"
import { Drawer } from "vaul"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface MobileSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  options: SelectOption[]
  label?: string
  className?: string
  triggerClassName?: string
}

export function MobileSelect({
  value,
  onValueChange,
  placeholder = "Выберите...",
  options,
  label,
  className,
  triggerClassName,
}: MobileSelectProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className={className}>
      {/* Mobile: vaul bottom-sheet drawer */}
      <div className="sm:hidden">
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Trigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-between font-normal text-sm h-9 px-3",
                !selected && "text-muted-foreground",
                triggerClassName
              )}
            >
              <span className="truncate">{selected?.label ?? placeholder}</span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50 ml-2" />
            </Button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background border-t outline-none max-h-[70svh]">
              <div className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-muted-foreground/30 shrink-0" />
              {label && (
                <Drawer.Title className="px-4 pb-2 pt-1 text-sm font-semibold text-foreground">
                  {label}
                </Drawer.Title>
              )}
              <div className="overflow-y-auto flex-1 py-2">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 text-sm text-left",
                      "hover:bg-muted active:bg-muted transition-colors",
                      opt.disabled && "opacity-40 cursor-not-allowed",
                      opt.value === value && "font-medium"
                    )}
                    onClick={() => {
                      if (!opt.disabled) {
                        onValueChange(opt.value)
                        setOpen(false)
                      }
                    }}
                  >
                    <span>{opt.label}</span>
                    {opt.value === value && (
                      <CheckIcon className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <div className="h-safe-bottom" />
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>

      {/* Desktop: standard Radix Select */}
      <div className="hidden sm:block">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className={triggerClassName}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
