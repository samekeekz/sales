"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DownloadIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { ReportTable } from "@/components/report-table"
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
  exportToCSV,
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

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("week")

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

  const { summaries, periodLabel, debtSummaries, totalOutstanding, filtered, from, to } = useMemo(() => {
    let from: Date
    let to: Date
    let periodLabel: string

    if (period === "week") {
      const range = getWeekRange()
      from = range.from
      to = range.to
      periodLabel = "неделя"
    } else if (period === "month") {
      const range = getMonthRange()
      from = range.from
      to = range.to
      periodLabel = "месяц"
    } else {
      from = customFrom ? new Date(customFrom) : new Date()
      to = customTo ? new Date(customTo) : new Date()
      to.setHours(23, 59, 59, 999)
      periodLabel = "период"
    }

    const filtered = filterSalesByDateRange(sales, from, to)
    const summaries = getDriverSummaries(filtered, settings)
    const debtSummaries = getDebtSummaries(debts)
    const totalOutstanding = getTotalOutstandingDebt(debts)

    return { summaries, periodLabel, debtSummaries, totalOutstanding, filtered, from, to }
  }, [sales, debts, settings, period, customFrom, customTo])

  const { dailyTrend, topStores, productBreakdown, commissionChart } = useMemo(() => {
    // Daily trend — build skeleton of all days in range then fill
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000)
    const days: Record<string, { label: string; quantity: number; amount: number; commission: number }> = {}

    if (diffDays <= 366) {
      const cursor = new Date(from)
      cursor.setHours(0, 0, 0, 0)
      while (cursor <= to) {
        const iso = cursor.toISOString().split("T")[0]
        const label = cursor.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
        days[iso] = { label, quantity: 0, amount: 0, commission: 0 }
        cursor.setDate(cursor.getDate() + 1)
      }
      for (const s of filtered) {
        if (days[s.date]) {
          days[s.date].quantity += s.quantity
          days[s.date].amount += s.totalAmount
          days[s.date].commission += s.commission
        }
      }
    }
    const dailyTrend = Object.values(days)

    // Top stores by revenue
    const storeMap = new Map<string, { name: string; amount: number; quantity: number }>()
    for (const s of filtered) {
      if (s.storeName) {
        const e = storeMap.get(s.storeName) || { name: s.storeName, amount: 0, quantity: 0 }
        e.amount += s.totalAmount
        e.quantity += s.quantity
        storeMap.set(s.storeName, e)
      }
    }
    const topStores = Array.from(storeMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

    // Product breakdown
    const productMap = new Map<string, { name: string; quantity: number; amount: number }>()
    for (const s of filtered) {
      const name = s.productName || "Без названия"
      const e = productMap.get(name) || { name, quantity: 0, amount: 0 }
      e.quantity += s.quantity
      e.amount += s.totalAmount
      productMap.set(name, e)
    }
    const productBreakdown = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity)

    // Commission per driver
    const commissionChart = summaries
      .slice(0, 10)
      .map((s) => ({ name: s.driverName, commission: s.totalCommission, amount: s.totalAmount }))

    return { dailyTrend, topStores, productBreakdown, commissionChart }
  }, [filtered, from, to, summaries])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Отчёты</h1>
          <p className="text-sm text-muted-foreground">
            Сводные отчёты по поставкам, комиссиям и долгам магазинов
          </p>
        </div>
        {status === "success" && summaries.length > 0 && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportToCSV(summaries, periodLabel)}
          >
            <DownloadIcon className="h-4 w-4" />
            Экспорт CSV
          </Button>
        )}
      </div>

      {/* Period selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Период</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="week">Неделя</TabsTrigger>
              <TabsTrigger value="month">Месяц</TabsTrigger>
              <TabsTrigger value="custom">Произвольный</TabsTrigger>
            </TabsList>
          </Tabs>

          {period === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Дата от</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Дата до</Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics charts */}
      {status === "loading" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px] rounded-lg" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">Не удалось загрузить данные</p>
          <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-base font-semibold mb-3 text-foreground">Аналитика</h2>
            <div className="grid gap-6 lg:grid-cols-2">

              {/* 1. Daily delivery trend */}
              {dailyTrend.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Динамика поставок</CardTitle>
                    <p className="text-xs text-muted-foreground">Количество единиц и выручка по дням</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-[240px]">
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
                          <YAxis
                            yAxisId="amt"
                            orientation="right"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => formatNumber(v)}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) =>
                              name === "quantity"
                                ? [`${formatNumber(value)} ед.`, "Количество"]
                                : [formatCurrency(value), "Выручка"]
                            }
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Legend
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11 }}
                            formatter={(v) => (v === "quantity" ? "Кол-во (ед.)" : "Выручка (тг)")}
                          />
                          <Bar dataKey="quantity" yAxisId="qty" fill="#3b82f6" radius={[3, 3, 0, 0]} name="quantity" />
                          <Line
                            dataKey="amount"
                            yAxisId="amt"
                            type="monotone"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            name="amount"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 2. Driver volumes */}
              {summaries.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Объём поставок по водителям</CardTitle>
                    <p className="text-xs text-muted-foreground">Количество единиц за период</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={summaries.slice(0, 8).map((s) => ({
                            name: s.driverName,
                            quantity: s.totalQuantity,
                          }))}
                          layout="vertical"
                          margin={{ left: 0, right: 56, top: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => formatNumber(v)}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={80}
                          />
                          <Tooltip
                            formatter={(value: number) => [`${formatNumber(value)} ед.`, "Количество"]}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                            <LabelList
                              dataKey="quantity"
                              position="right"
                              formatter={(v: number) => `${formatNumber(v)} ед.`}
                              style={{ fontSize: 10, fill: "#6b7280" }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 3. Top stores by revenue */}
              {topStores.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Топ магазинов по выручке</CardTitle>
                    <p className="text-xs text-muted-foreground">Сумма поставок за период</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topStores}
                          layout="vertical"
                          margin={{ left: 0, right: 80, top: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => formatNumber(v)}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={80}
                          />
                          <Tooltip
                            formatter={(value: number) => [formatCurrency(value), "Выручка"]}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Bar dataKey="amount" fill="#22c55e" radius={[0, 4, 4, 0]}>
                            <LabelList
                              dataKey="amount"
                              position="right"
                              formatter={(v: number) => formatCurrency(v)}
                              style={{ fontSize: 9, fill: "#6b7280" }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 4. Product breakdown pie */}
              {productBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Структура по товарам</CardTitle>
                    <p className="text-xs text-muted-foreground">Доля каждого товара в общем объёме</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={productBreakdown}
                            dataKey="quantity"
                            nameKey="name"
                            cx="40%"
                            cy="50%"
                            outerRadius={90}
                            innerRadius={44}
                          >
                            {productBreakdown.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [`${formatNumber(value)} ед.`, "Количество"]}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Legend
                            layout="vertical"
                            align="right"
                            verticalAlign="middle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 5. Commission vs Revenue per driver — full width */}
              {commissionChart.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Выручка и комиссии по водителям</CardTitle>
                    <p className="text-xs text-muted-foreground">Сравнение суммы поставок с начисленными комиссиями</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={commissionChart} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => formatNumber(v)}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) =>
                              name === "commission"
                                ? [formatCurrency(value), "Комиссия"]
                                : [formatCurrency(value), "Выручка"]
                            }
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Legend
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11 }}
                            formatter={(v) => (v === "commission" ? "Комиссия" : "Выручка")}
                          />
                          <Bar dataKey="amount" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="amount" />
                          <Bar dataKey="commission" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="commission" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Debt chart */}
          {debtSummaries.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3 text-foreground">Долги по магазинам</h2>
              <Card>
                <CardContent className="pt-4 px-3 pb-3">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={debtSummaries.map((s) => ({ name: s.storeName, debt: s.totalDebt }))}
                        layout="vertical"
                        margin={{ left: 0, right: 84, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatNumber(v)}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={90}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), "Долг"]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Bar dataKey="debt" fill="#ef4444" radius={[0, 4, 4, 0]}>
                          <LabelList
                            dataKey="debt"
                            position="right"
                            formatter={(v: number) => formatCurrency(v)}
                            style={{ fontSize: 10, fill: "#6b7280" }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Commission table */}
          <div>
            <h2 className="text-base font-semibold mb-3 text-foreground">Комиссии водителей</h2>
            <ReportTable summaries={summaries} threshold={settings.commissionThreshold} />
          </div>

          {/* Debt table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">Непогашенные долги магазинов</h2>
              {totalOutstanding > 0 && (
                <span className="text-sm text-destructive font-medium">
                  Всего: {formatCurrency(totalOutstanding)}
                </span>
              )}
            </div>

            {debtSummaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
                <p className="text-sm text-muted-foreground">Непогашенных долгов нет</p>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
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
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
