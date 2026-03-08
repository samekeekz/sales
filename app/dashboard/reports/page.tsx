"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DownloadIcon, ImageIcon, FileSpreadsheetIcon } from "lucide-react"
import {
  Tooltip as UITooltip,
  TooltipContent as UITooltipContent,
  TooltipProvider,
  TooltipTrigger as UITooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { getSales } from "@/app/actions/sales"
import { getSettings } from "@/app/actions/settings"
import { getDebts } from "@/app/actions/debts"
import type { SaleRecord, DebtRecord } from "@/lib/types"
import {
  getDriverSummaries,
  getWeekRange,
  getMonthRange,
  filterSalesByDateRange,
  getDebtSummaries,
  getTotalOutstandingDebt,
  exportCommissionsToExcel,
  exportDebtsToExcel,
  formatCurrency,
  formatNumber,
} from "@/lib/calculations"
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts"

type Period = "week" | "month" | "custom"

const DEFAULT_SETTINGS = {
  commissionThreshold: 200,
  lowRate: 0.05,
  highRate: 0.07,
  commissionTiers: [] as { from: number; rate: number }[],
}

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316", "#10b981"]

function yAxisWidth(items: { name: string }[], min = 60, max = 140): number {
  const longest = items.reduce((m, item) => Math.max(m, item.name.length), 0)
  return Math.min(Math.max(longest * 7, min), max)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split("T")[0]
}

function downloadChartAsPNG(containerRef: React.RefObject<HTMLDivElement | null>, filename: string) {
  const svg = containerRef.current?.querySelector("svg")
  if (!svg) return
  const bbox = svg.getBoundingClientRect()
  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute("width", String(bbox.width))
  clone.setAttribute("height", String(bbox.height))
  const svgData = new XMLSerializer().serializeToString(clone)
  const canvas = document.createElement("canvas")
  canvas.width = bbox.width
  canvas.height = bbox.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const img = new Image()
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  img.onload = () => {
    ctx.drawImage(img, 0, 0)
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = filename + ".png"
    a.click()
    URL.revokeObjectURL(url)
  }
  img.src = url
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("week")
  const [contentTab, setContentTab] = useState("analytics")

  const monthDefaults = useMemo(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
    return { from, to }
  }, [])

  const [customFrom, setCustomFrom] = useState(monthDefaults.from)
  const [customTo, setCustomTo] = useState(monthDefaults.to)
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  // Chart refs for PNG export
  const trendRef = useRef<HTMLDivElement>(null)
  const driverVolRef = useRef<HTMLDivElement>(null)
  const storesRef = useRef<HTMLDivElement>(null)
  const productRef = useRef<HTMLDivElement>(null)
  const commRef = useRef<HTMLDivElement>(null)
  const debtChartRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    setStatus("loading")
    try {
      const [s, d, st] = await Promise.all([getSales(), getDebts(), getSettings()])
      setSales(s)
      setDebts(d)
      setSettings(st)
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Compute date range strings for filtering
  const { fromStr, toStr, periodLabel, from, to } = useMemo(() => {
    if (period === "week") {
      const r = getWeekRange()
      return {
        fromStr: r.from.toISOString().split("T")[0],
        toStr: r.to.toISOString().split("T")[0],
        periodLabel: "неделя",
        from: r.from,
        to: r.to,
      }
    }
    if (period === "month") {
      const r = getMonthRange()
      return {
        fromStr: r.from.toISOString().split("T")[0],
        toStr: r.to.toISOString().split("T")[0],
        periodLabel: "месяц",
        from: r.from,
        to: r.to,
      }
    }
    // Custom: use strings directly to avoid timezone issues
    const f = customFrom || monthDefaults.from
    const t = customTo || monthDefaults.to
    return {
      fromStr: f,
      toStr: t,
      periodLabel: "период",
      from: new Date(f + "T00:00:00"),
      to: new Date(t + "T23:59:59"),
    }
  }, [period, customFrom, customTo, monthDefaults])

  // Bug fix: use string comparison for custom dates to avoid timezone issues
  const filtered = useMemo(() => {
    if (period === "custom") {
      return sales.filter((s) => s.date >= fromStr && s.date <= toStr)
    }
    return filterSalesByDateRange(sales, from, to)
  }, [sales, period, from, to, fromStr, toStr])

  const summaries = useMemo(() => getDriverSummaries(filtered, settings), [filtered, settings])
  const debtSummaries = useMemo(() => getDebtSummaries(debts), [debts])
  const totalOutstanding = useMemo(() => getTotalOutstandingDebt(debts), [debts])

  const { dailyTrend, topStores, productBreakdown, commissionChart } = useMemo(() => {
    // Use string-based date iteration to avoid timezone bugs
    const days: Record<string, { label: string; quantity: number; amount: number; commission: number }> = {}
    let current = fromStr
    let iterations = 0
    while (current <= toStr && iterations < 400) {
      const d = new Date(current + "T12:00:00Z")
      const label = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" })
      days[current] = { label, quantity: 0, amount: 0, commission: 0 }
      current = addDays(current, 1)
      iterations++
    }
    for (const s of filtered) {
      if (days[s.date]) {
        days[s.date].quantity += s.quantity
        days[s.date].amount += s.totalAmount
        days[s.date].commission += s.commission
      }
    }
    const dailyTrend = Object.values(days)

    const storeMap = new Map<string, { name: string; amount: number; quantity: number }>()
    for (const s of filtered) {
      if (s.storeName) {
        const e = storeMap.get(s.storeName) || { name: s.storeName, amount: 0, quantity: 0 }
        e.amount += s.totalAmount
        e.quantity += s.quantity
        storeMap.set(s.storeName, e)
      }
    }
    const topStores = Array.from(storeMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 8)

    const productMap = new Map<string, { name: string; quantity: number; amount: number }>()
    for (const s of filtered) {
      const name = s.productName || "Без названия"
      const e = productMap.get(name) || { name, quantity: 0, amount: 0 }
      e.quantity += s.quantity
      e.amount += s.totalAmount
      productMap.set(name, e)
    }
    const productBreakdown = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity)

    const commissionChart = summaries
      .slice(0, 10)
      .map((s) => ({ name: s.driverName, commission: s.totalCommission, amount: s.totalAmount }))

    return { dailyTrend, topStores, productBreakdown, commissionChart }
  }, [filtered, fromStr, toStr, summaries])

  const totalQty = summaries.reduce((s, d) => s + d.totalQuantity, 0)
  const totalAmt = summaries.reduce((s, d) => s + d.totalAmount, 0)
  const totalComm = summaries.reduce((s, d) => s + d.totalCommission, 0)

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col gap-3 h-[calc(100svh-5.5rem)] md:h-[calc(100svh-6.5rem)]">
      {/* Compact header: title + period selector */}
      <div className="shrink-0 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Отчёты</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Сводные отчёты по поставкам, комиссиям и долгам
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="week">Неделя</TabsTrigger>
              <TabsTrigger value="month">Месяц</TabsTrigger>
              <TabsTrigger value="custom">Период</TabsTrigger>
            </TabsList>
          </Tabs>
          {period === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-36 h-9 text-sm"
              />
              <span className="text-muted-foreground text-sm">—</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-36 h-9 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Content tabs */}
      <Tabs
        value={contentTab}
        onValueChange={setContentTab}
        className="flex-1 min-h-0 flex flex-col gap-0"
      >
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="commissions">Комиссии водителей</TabsTrigger>
          <TabsTrigger value="debts">Долги магазинов</TabsTrigger>
        </TabsList>

        {/* Analytics tab */}
        <TabsContent
          value="analytics"
          className="flex-1 min-h-0 overflow-y-auto mt-3"
        >
          {status === "loading" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-70 rounded-lg" />
              ))}
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
              <p className="text-sm text-muted-foreground">Не удалось загрузить данные</p>
              <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
              <p className="text-sm text-muted-foreground">Нет данных за выбранный период</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 pb-4">
              {dailyTrend.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">Динамика поставок</CardTitle>
                        <p className="text-xs text-muted-foreground">Количество единиц и выручка по дням</p>
                      </div>
                      <UITooltip>
                        <UITooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => downloadChartAsPNG(trendRef, "динамика_поставок")}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </Button>
                        </UITooltipTrigger>
                        <UITooltipContent>Скачать график как PNG</UITooltipContent>
                      </UITooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-55" ref={trendRef}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dailyTrend} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            interval={dailyTrend.length > 14 ? Math.floor(dailyTrend.length / 7) : 0}
                          />
                          <YAxis yAxisId="qty" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="amt" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                          <Tooltip
                            formatter={(value: number, name: string) =>
                              name === "quantity"
                                ? [`${formatNumber(value)} ед.`, "Количество"]
                                : [formatCurrency(value), "Выручка"]
                            }
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "quantity" ? "Кол-во (ед.)" : "Выручка (тг)")} />
                          <Bar dataKey="quantity" yAxisId="qty" fill="#3b82f6" radius={[3, 3, 0, 0]} name="quantity" />
                          <Line dataKey="amount" yAxisId="amt" type="monotone" stroke="#f59e0b" strokeWidth={2} dot={false} name="amount" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {summaries.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">Объём поставок по водителям</CardTitle>
                        <p className="text-xs text-muted-foreground">Количество единиц за период</p>
                      </div>
                      <UITooltip>
                        <UITooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => downloadChartAsPNG(driverVolRef, "объём_по_водителям")}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </Button>
                        </UITooltipTrigger>
                        <UITooltipContent>Скачать график как PNG</UITooltipContent>
                      </UITooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-55" ref={driverVolRef}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={summaries.slice(0, 8).map((s) => ({ name: s.driverName, quantity: s.totalQuantity }))}
                          layout="vertical"
                          margin={{ left: 0, right: 60, top: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={yAxisWidth(summaries.slice(0, 8).map((s) => ({ name: s.driverName })))} />
                          <Tooltip formatter={(value: number) => [`${formatNumber(value)} ед.`, "Количество"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                            <LabelList dataKey="quantity" position="right" formatter={(v: number) => `${formatNumber(v)} ед.`} style={{ fontSize: 10, fill: "#6b7280" }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {topStores.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">Топ магазинов по выручке</CardTitle>
                        <p className="text-xs text-muted-foreground">Сумма поставок за период</p>
                      </div>
                      <UITooltip>
                        <UITooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => downloadChartAsPNG(storesRef, "топ_магазинов")}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </Button>
                        </UITooltipTrigger>
                        <UITooltipContent>Скачать график как PNG</UITooltipContent>
                      </UITooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-55" ref={storesRef}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topStores} layout="vertical" margin={{ left: 0, right: 90, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={yAxisWidth(topStores)} />
                          <Tooltip formatter={(value: number) => [formatCurrency(value), "Выручка"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Bar dataKey="amount" fill="#22c55e" radius={[0, 4, 4, 0]}>
                            <LabelList dataKey="amount" position="right" formatter={(v: number) => formatCurrency(v)} style={{ fontSize: 9, fill: "#6b7280" }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {productBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">Структура по товарам</CardTitle>
                        <p className="text-xs text-muted-foreground">Доля каждого товара в общем объёме</p>
                      </div>
                      <UITooltip>
                        <UITooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => downloadChartAsPNG(productRef, "структура_товаров")}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </Button>
                        </UITooltipTrigger>
                        <UITooltipContent>Скачать график как PNG</UITooltipContent>
                      </UITooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-55" ref={productRef}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={productBreakdown} dataKey="quantity" nameKey="name" cx="40%" cy="50%" outerRadius={90} innerRadius={44}>
                            {productBreakdown.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${formatNumber(value)} ед.`, "Количество"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {commissionChart.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">Выручка и комиссии по водителям</CardTitle>
                        <p className="text-xs text-muted-foreground">Сравнение суммы поставок с начисленными комиссиями</p>
                      </div>
                      <UITooltip>
                        <UITooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => downloadChartAsPNG(commRef, "комиссии_по_водителям")}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </Button>
                        </UITooltipTrigger>
                        <UITooltipContent>Скачать график как PNG</UITooltipContent>
                      </UITooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-50" ref={commRef}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={commissionChart} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                          <Tooltip formatter={(value: number, name: string) => name === "commission" ? [formatCurrency(value), "Комиссия"] : [formatCurrency(value), "Выручка"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "commission" ? "Комиссия" : "Выручка")} />
                          <Bar dataKey="amount" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="amount" />
                          <Bar dataKey="commission" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="commission" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Commissions tab */}
        <TabsContent
          value="commissions"
          className="flex-1 min-h-0 mt-3 flex flex-col gap-3"
        >
          <div className="shrink-0 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {status === "success" && (
                <span>
                  {summaries.length} водителей · {formatNumber(totalQty)} ед. · {formatCurrency(totalAmt)} · комиссия: {formatCurrency(totalComm)}
                </span>
              )}
            </div>
            {status === "success" && summaries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => exportCommissionsToExcel(summaries, periodLabel)}
              >
                <FileSpreadsheetIcon className="h-4 w-4" />
                Экспорт Excel
              </Button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
            {status === "loading" ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : status === "error" ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-muted-foreground">Не удалось загрузить данные</p>
                <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
              </div>
            ) : summaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <p className="text-sm text-muted-foreground">Нет данных за выбранный период</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Водитель</TableHead>
                    <TableHead className="text-right">Кол-во (ед.)</TableHead>
                    <TableHead className="hidden sm:table-cell">Прогресс</TableHead>
                    <TableHead className="text-right">Сумма продаж</TableHead>
                    <TableHead className="text-right">Ставка</TableHead>
                    <TableHead className="text-right">Комиссия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={s.driverName}>
                      <TableCell className="font-medium">{s.driverName}</TableCell>
                      <TableCell className="text-right">{formatNumber(s.totalQuantity)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress value={s.progressToThreshold} className="h-2 w-20" />
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(s.totalQuantity)}/{formatNumber(settings.commissionThreshold)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(s.totalAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={s.commissionRate >= 0.07 ? "default" : "secondary"}>
                          {(s.commissionRate * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(s.totalCommission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Итого</TableCell>
                    <TableCell className="text-right font-bold">{formatNumber(totalQty)}</TableCell>
                    <TableCell className="hidden sm:table-cell" />
                    <TableCell className="text-right font-bold">{formatCurrency(totalAmt)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold">{formatCurrency(totalComm)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Debts tab */}
        <TabsContent
          value="debts"
          className="flex-1 min-h-0 mt-3 flex flex-col gap-3"
        >
          <div className="shrink-0 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {status === "success" && totalOutstanding > 0 && (
                <span className="text-destructive font-medium">
                  Всего долгов: {formatCurrency(totalOutstanding)}
                </span>
              )}
            </div>
            {status === "success" && debtSummaries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => exportDebtsToExcel(debtSummaries, totalOutstanding)}
              >
                <FileSpreadsheetIcon className="h-4 w-4" />
                Экспорт Excel
              </Button>
            )}
          </div>

          {/* Debt chart */}
          {status === "success" && debtSummaries.length > 0 && (
            <Card className="shrink-0">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Долги по магазинам</CardTitle>
                  <UITooltip>
                    <UITooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => downloadChartAsPNG(debtChartRef, "долги_по_магазинам")}
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                      </Button>
                    </UITooltipTrigger>
                    <UITooltipContent>Скачать график как PNG</UITooltipContent>
                  </UITooltip>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="h-45" ref={debtChartRef}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={debtSummaries.map((s) => ({ name: s.storeName, debt: s.totalDebt }))}
                      layout="vertical"
                      margin={{ left: 0, right: 90, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={yAxisWidth(debtSummaries.map((s) => ({ name: s.storeName })))} />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Долг"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="debt" fill="#ef4444" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="debt" position="right" formatter={(v: number) => formatCurrency(v)} style={{ fontSize: 10, fill: "#6b7280" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
            {status === "loading" ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : status === "error" ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-muted-foreground">Не удалось загрузить данные</p>
                <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
              </div>
            ) : debtSummaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Непогашенных долгов нет</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Магазин</TableHead>
                    <TableHead className="text-right">Долгов</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Старейший долг</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtSummaries.map((s) => (
                    <TableRow key={s.storeId}>
                      <TableCell className="font-medium">{s.storeName}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{s.unpaidCount}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right text-muted-foreground text-sm">
                        {s.oldestUnpaidDate
                          ? new Date(s.oldestUnpaidDate + "T00:00:00").toLocaleDateString("ru-RU")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {formatCurrency(s.totalDebt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Итого</TableCell>
                    <TableCell className="text-right font-bold">
                      {debtSummaries.reduce((s, d) => s + d.unpaidCount, 0)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell" />
                    <TableCell className="text-right font-bold text-destructive">
                      {formatCurrency(totalOutstanding)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </TooltipProvider>
  )
}
