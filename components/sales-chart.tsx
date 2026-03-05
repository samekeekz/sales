"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { SaleRecord } from "@/lib/types"
import { formatCurrency, formatNumber } from "@/lib/calculations"

interface SalesChartProps {
  sales: SaleRecord[]
}

type ChartPeriod = "7d" | "30d"

export function SalesChart({ sales }: SalesChartProps) {
  const [period, setPeriod] = useState<ChartPeriod>("7d")

  const { chartData, dailyAverage } = useMemo(() => {
    const days: Record<
      string,
      {
        date: string
        label: string
        quantity: number
        amount: number
        commission: number
        driverCount: number
      }
    > = {}

    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    const startDate = new Date()
    if (period === "7d") {
      startDate.setDate(startDate.getDate() - 6)
    } else {
      startDate.setDate(startDate.getDate() - 29)
    }
    startDate.setHours(0, 0, 0, 0)

    const cursor = new Date(startDate)
    while (cursor <= endDate) {
      const iso = cursor.toISOString().split("T")[0]
      const label =
        period === "30d"
          ? cursor.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
          : cursor.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" })
      days[iso] = { date: iso, label, quantity: 0, amount: 0, commission: 0, driverCount: 0 }
      cursor.setDate(cursor.getDate() + 1)
    }

    for (const sale of sales) {
      if (days[sale.date]) {
        days[sale.date].quantity += sale.quantity
        days[sale.date].amount += sale.totalAmount
        days[sale.date].commission += sale.commission
      }
    }

    const dayDrivers: Record<string, Set<string>> = {}
    for (const sale of sales) {
      if (days[sale.date]) {
        if (!dayDrivers[sale.date]) dayDrivers[sale.date] = new Set()
        dayDrivers[sale.date].add(sale.driverName)
      }
    }
    for (const [date, driverSet] of Object.entries(dayDrivers)) {
      if (days[date]) days[date].driverCount = driverSet.size
    }

    const data = Object.values(days)
    const nonZeroDays = data.filter((d) => d.quantity > 0)
    const dailyAverage =
      nonZeroDays.length > 0
        ? Math.round(nonZeroDays.reduce((s, d) => s + d.quantity, 0) / nonZeroDays.length)
        : 0

    return { chartData: data, dailyAverage }
  }, [sales, period])

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: { payload: (typeof chartData)[0] }[]
    label?: string
  }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="rounded-lg border bg-card p-3 text-sm shadow-md">
        <p className="font-medium text-foreground mb-2">{label}</p>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Количество:</span>
            <span className="font-medium">{formatNumber(d.quantity)} ед.</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Сумма:</span>
            <span className="font-medium">{formatCurrency(d.amount)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Комиссии:</span>
            <span className="font-medium">{formatCurrency(d.commission)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Водителей:</span>
            <span className="font-medium">{d.driverCount}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Поставки</CardTitle>
          <div className="flex items-center gap-1">
            {(["7d", "30d"] as ChartPeriod[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPeriod(p)}
              >
                {p === "7d" ? "7 дней" : "30 дней"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                interval={period === "30d" ? 4 : 0}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="qty"
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="amt"
                orientation="right"
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatNumber(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconSize={10}
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) =>
                  value === "quantity" ? "Количество (ед.)" : "Сумма (тг)"
                }
              />
              {dailyAverage > 0 && (
                <ReferenceLine
                  yAxisId="qty"
                  y={dailyAverage}
                  stroke="#9ca3af"
                  strokeDasharray="4 2"
                  label={{
                    value: `Ср. ${dailyAverage} ед.`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#6b7280",
                  }}
                />
              )}
              <Bar dataKey="quantity" yAxisId="qty" radius={[4, 4, 0, 0]} name="quantity">
                {chartData.map((entry) => (
                  <Cell
                    key={entry.date}
                    fill={
                      entry.quantity === 0
                        ? "#e5e7eb"
                        : entry.quantity >= dailyAverage
                        ? "#22c55e"
                        : "#f59e0b"
                    }
                  />
                ))}
              </Bar>
              <Line
                dataKey="amount"
                yAxisId="amt"
                type="monotone"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="amount"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
