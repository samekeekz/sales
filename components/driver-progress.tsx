"use client"

import { Progress } from "@/components/ui/progress"
import { formatNumber } from "@/lib/calculations"

interface DriverProgressProps {
  currentQuantity: number
  threshold: number
  lowRate: number
  highRate: number
}

export function DriverProgress({
  currentQuantity,
  threshold,
  lowRate,
  highRate,
}: DriverProgressProps) {
  const progress = Math.min((currentQuantity / threshold) * 100, 100)
  const remaining = Math.max(threshold - currentQuantity, 0)
  const reachedThreshold = currentQuantity >= threshold

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Прогресс до {(highRate * 100).toFixed(0)}% ставки
        </span>
        <span className="font-medium text-foreground">
          {formatNumber(currentQuantity)} / {formatNumber(threshold)} ед.
        </span>
      </div>
      <Progress value={progress} />
      <p className="text-xs text-muted-foreground">
        {reachedThreshold ? (
          <span className="font-medium text-chart-2">
            Повышенная ставка {(highRate * 100).toFixed(0)}% активна
          </span>
        ) : (
          <>
            Текущая ставка: {(lowRate * 100).toFixed(0)}%. Ещё{" "}
            <span className="font-medium text-foreground">{formatNumber(remaining)} ед.</span>{" "}
            до {(highRate * 100).toFixed(0)}%
          </>
        )}
      </p>
    </div>
  )
}
