"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusCircleIcon, AlertTriangleIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { MetricsCards } from "@/components/metrics-cards"
import { SalesChart } from "@/components/sales-chart"
import { useAuth } from "@/components/auth-provider"
import { getSales } from "@/app/actions/sales"
import { getDrivers } from "@/app/actions/drivers"
import { getSettings } from "@/app/actions/settings"
import { getDebts } from "@/app/actions/debts"
import type { SaleRecord, Driver, DebtRecord } from "@/lib/types"
import {
  getDriverSummaries,
  getWeekRange,
  getMonthRange,
  filterSalesByDateRange,
  getDebtSummaries,
  getTotalOutstandingDebt,
  formatNumber,
  formatCurrency,
} from "@/lib/calculations"

const DEFAULT_SETTINGS = { commissionThreshold: 200, lowRate: 0.05, highRate: 0.07 }

export default function DashboardPage() {
  const { isAccountant } = useAuth()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [drivers, setDrivers] = useState<Driver[]>([])

  const loadData = useCallback(async () => {
    setStatus("loading")
    try {
      const [s, d, st, dr] = await Promise.all([getSales(), getDebts(), getSettings(), getDrivers()])
      setSales(s)
      setDebts(d)
      setSettings(st)
      setDrivers(dr)
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const {
    summaries,
    totalAmount,
    totalCommission,
    totalQuantity,
    debtSummaries,
    totalOutstanding,
    monthDriverData,
  } = useMemo(() => {
    const { from: weekFrom, to: weekTo } = getWeekRange()
    const { from: monthFrom, to: monthTo } = getMonthRange()

    const weekSales = filterSalesByDateRange(sales, weekFrom, weekTo)
    const monthSales = filterSalesByDateRange(sales, monthFrom, monthTo)

    const summaries = getDriverSummaries(weekSales, settings)
    const totalQuantity = summaries.reduce((s, d) => s + d.totalQuantity, 0)
    const totalAmount = summaries.reduce((s, d) => s + d.totalAmount, 0)
    const totalCommission = summaries.reduce((s, d) => s + d.totalCommission, 0)

    const debtSummaries = getDebtSummaries(debts)
    const totalOutstanding = getTotalOutstandingDebt(debts)

    const driverMonthMap = new Map<string, number>()
    for (const sale of monthSales) {
      driverMonthMap.set(sale.driverName, (driverMonthMap.get(sale.driverName) || 0) + sale.quantity)
    }
    const monthDriverData = Array.from(driverMonthMap.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8)

    return {
      summaries,
      totalAmount,
      totalCommission,
      totalQuantity,
      debtSummaries,
      totalOutstanding,
      monthDriverData,
    }
  }, [sales, debts, settings])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Панель управления</h1>
          <p className="text-sm text-muted-foreground">
            Сводка за текущую неделю
          </p>
        </div>
        {isAccountant && (
          <Button asChild>
            <Link href="/dashboard/add-sale" className="gap-2">
              <PlusCircleIcon className="h-4 w-4" />
              Записать поставку
            </Link>
          </Button>
        )}
      </div>

      {status === "loading" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">Не удалось загрузить данные</p>
          <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
        </div>
      ) : (
        <MetricsCards
          totalQuantity={totalQuantity}
          totalAmount={totalAmount}
          totalCommission={totalCommission}
          driversCount={drivers.length}
        />
      )}

      {status === "success" && isAccountant && debtSummaries.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50/50 dark:border-yellow-700 dark:bg-yellow-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                <CardTitle className="text-base text-yellow-800 dark:text-yellow-400">
                  Непогашенные долги магазинов
                </CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                <Link href="/dashboard/debts">Смотреть все</Link>
              </Button>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-0.5">
              {debtSummaries.length}{" "}
              {debtSummaries.length === 1 ? "магазин" : debtSummaries.length < 5 ? "магазина" : "магазинов"}{" "}
              · Всего: {formatCurrency(totalOutstanding)}
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Магазин</TableHead>
                  <TableHead className="text-right">Долгов</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Старейший</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtSummaries.slice(0, 5).map((s) => (
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
                    <TableCell className="text-right text-destructive font-medium">
                      {formatCurrency(s.totalDebt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {status === "success" && <div className="grid gap-6 lg:grid-cols-2">
        <SalesChart sales={sales} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Доставки по водителям за месяц</CardTitle>
          </CardHeader>
          <CardContent>
            {monthDriverData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Нет данных за текущий месяц
              </p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthDriverData}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      width={80}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${formatNumber(value)} ед.`, "Поставлено"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="quantity" radius={[0, 4, 4, 0]}>
                      {monthDriverData.map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>}

      {status === "success" && <Card>
        <CardHeader>
          <CardTitle className="text-base">Топ водителей за неделю</CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Нет данных за текущую неделю
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Водитель</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="text-right">Сумма к сбору</TableHead>
                  <TableHead className="text-right">Комиссия</TableHead>
                  <TableHead className="text-right">Ставка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.slice(0, 5).map((s) => (
                  <TableRow key={s.driverName}>
                    <TableCell className="font-medium">{s.driverName}</TableCell>
                    <TableCell className="text-right">{formatNumber(s.totalQuantity)} ед.</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.totalAmount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.totalCommission)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={s.commissionRate >= settings.highRate ? "default" : "secondary"}>
                        {(s.commissionRate * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>}
    </div>
  )
}
