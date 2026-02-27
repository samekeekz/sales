"use client"

import { useMemo, useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeftIcon } from "lucide-react"
import { getSales } from "@/app/actions/sales"
import { getDebts } from "@/app/actions/debts"
import type { SaleRecord, DebtRecord } from "@/lib/types"
import { groupByDelivery, formatNumber, formatCurrency } from "@/lib/calculations"

export default function DriverProfilePage() {
  const params = useParams()
  const driverName = decodeURIComponent(params.name as string)

  const [sales, setSales] = useState<SaleRecord[]>([])
  const [debts, setDebts] = useState<DebtRecord[]>([])

  useEffect(() => {
    Promise.all([getSales(), getDebts()]).then(([s, d]) => {
      setSales(s)
      setDebts(d)
    })
  }, [])

  const { groups, totalQty, totalAmt, totalComm } = useMemo(() => {
    const driverSales = sales.filter((s) => s.driverName === driverName)
    const groups = groupByDelivery(driverSales)
    const totalQty = driverSales.reduce((s, r) => s + r.quantity, 0)
    const totalAmt = driverSales.reduce((s, r) => s + r.totalAmount, 0)
    const totalComm = driverSales.reduce((s, r) => s + r.commission, 0)
    return { groups, totalQty, totalAmt, totalComm }
  }, [sales, driverName])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/drivers">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{driverName}</h1>
          <p className="text-sm text-muted-foreground">История поставок водителя</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего поставлено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(totalQty)}</p>
            <p className="text-xs text-muted-foreground mt-1">единиц за всё время</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Сумма к сбору
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalAmt)}</p>
            <p className="text-xs text-muted-foreground mt-1">за все поставки</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Комиссия
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalComm)}</p>
            <p className="text-xs text-muted-foreground mt-1">за все поставки</p>
          </CardContent>
        </Card>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">Нет записей о поставках</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead>Товары</TableHead>
                <TableHead className="text-right">Кол-во</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Комиссия</TableHead>
                <TableHead className="text-center">Долг</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const debt = debts.find((d) => d.deliveryId === group.deliveryId)
                const debtStatus = debt?.status ?? null
                return (
                  <TableRow key={group.deliveryId}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(group.date + "T00:00:00").toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell>{group.storeName ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-55">
                      {group.items
                        .map((item) => `${item.productName ?? "Товар"} × ${formatNumber(item.quantity)}`)
                        .join(", ")}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatNumber(group.totalQuantity)} ед.
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatCurrency(group.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">
                      {formatCurrency(group.totalCommission)}
                    </TableCell>
                    <TableCell className="text-center">
                      {debtStatus === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : debtStatus === "paid" ? (
                        <Badge variant="secondary">Оплачен</Badge>
                      ) : (
                        <Badge variant="destructive">Не оплачен</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
