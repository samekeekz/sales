"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
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
import { ReportTable } from "@/components/report-table"
import { getSales, getSettings, getDebts } from "@/lib/storage"
import {
  getDriverSummaries,
  getWeekRange,
  getMonthRange,
  filterSalesByDateRange,
  getDebtSummaries,
  getTotalOutstandingDebt,
  exportToCSV,
  formatCurrency,
} from "@/lib/calculations"

type Period = "week" | "month" | "custom"

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  return () => window.removeEventListener("storage", cb)
}

function getSalesSnapshot() {
  return localStorage.getItem("sales_records") || "[]"
}

function getDebtsSnapshot() {
  return localStorage.getItem("debt_records") || "[]"
}

function getServerSnapshot() {
  return "[]"
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("week")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const salesRaw = useSyncExternalStore(subscribe, getSalesSnapshot, getServerSnapshot)
  const debtsRaw = useSyncExternalStore(subscribe, getDebtsSnapshot, getServerSnapshot)

  const { summaries, settings, periodLabel, debtSummaries, totalOutstanding } = useMemo(() => {
    const allSales = getSales()
    const allDebts = getDebts()
    const settings = getSettings()

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
      from = customFrom ? new Date(customFrom) : new Date(0)
      to = customTo ? new Date(customTo) : new Date()
      to.setHours(23, 59, 59, 999)
      periodLabel = "период"
    }

    const filtered = filterSalesByDateRange(allSales, from, to)
    const summaries = getDriverSummaries(filtered, settings)

    // Debts: always show all outstanding (they accumulate over time)
    const debtSummaries = getDebtSummaries(allDebts)
    const totalOutstanding = getTotalOutstandingDebt(allDebts)

    return { summaries, settings, periodLabel, debtSummaries, totalOutstanding }
  }, [salesRaw, debtsRaw, period, customFrom, customTo])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Отчёты</h1>
          <p className="text-sm text-muted-foreground">
            Сводные отчёты по поставкам, комиссиям и долгам магазинов
          </p>
        </div>
        {summaries.length > 0 && (
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

      <div>
        <h2 className="text-base font-semibold mb-3 text-foreground">Комиссии водителей</h2>
        <ReportTable summaries={summaries} threshold={settings.commissionThreshold} />
      </div>

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
    </div>
  )
}
