"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { DriverSummary } from "@/lib/types"
import { formatNumber, formatCurrency } from "@/lib/calculations"

interface ReportTableProps {
  summaries: DriverSummary[]
  threshold: number
}

export function ReportTable({ summaries, threshold }: ReportTableProps) {
  const totalQty = summaries.reduce((s, d) => s + d.totalQuantity, 0)
  const totalAmt = summaries.reduce((s, d) => s + d.totalAmount, 0)
  const totalComm = summaries.reduce((s, d) => s + d.totalCommission, 0)

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <p className="text-sm text-muted-foreground">Нет данных за выбранный период</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
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
                    {formatNumber(s.totalQuantity)}/{formatNumber(threshold)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(s.totalAmount)}</TableCell>
              <TableCell className="text-right">
                <Badge variant={s.commissionRate >= 0.07 ? "default" : "secondary"}>
                  {(s.commissionRate * 100).toFixed(0)}%
                </Badge>
              </TableCell>
              <TableCell className="text-right font-bold">
                {formatCurrency(s.totalCommission)}
              </TableCell>
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
    </div>
  )
}
