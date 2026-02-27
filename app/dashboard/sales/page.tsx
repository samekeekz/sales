"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SalesTable } from "@/components/sales-table"
import { useAuth } from "@/components/auth-provider"
import { getSales } from "@/app/actions/sales"
import { getDrivers } from "@/app/actions/drivers"
import { getDebts } from "@/app/actions/debts"
import { getStores } from "@/app/actions/stores"
import type { SaleRecord, Driver, DebtRecord, Store } from "@/lib/types"
import { groupByDelivery } from "@/lib/calculations"

const ALL = "__all__"

export default function SalesPage() {
  const { isAccountant } = useAuth()
  const [driverFilter, setDriverFilter] = useState(ALL)
  const [storeFilter, setStoreFilter] = useState(ALL)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [sales, setSales] = useState<SaleRecord[]>([])
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [stores, setStores] = useState<Store[]>([])

  const loadData = useCallback(async () => {
    const [s, d, dr, st] = await Promise.all([getSales(), getDebts(), getDrivers(), getStores()])
    setSales(s)
    setDebts(d)
    setDrivers(dr)
    setStores(st)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const groups = useMemo(() => {
    let filtered = sales
    if (driverFilter !== ALL) {
      filtered = filtered.filter((s) => s.driverName === driverFilter)
    }
    if (dateFrom) {
      filtered = filtered.filter((s) => s.date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((s) => s.date <= dateTo)
    }

    let groups = groupByDelivery(filtered)
    if (storeFilter !== ALL) {
      groups = groups.filter((g) => g.storeId === storeFilter)
    }
    return groups
  }, [sales, driverFilter, storeFilter, dateFrom, dateTo])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">История поставок</h1>
        <p className="text-sm text-muted-foreground">
          Все записи о поставках сгруппированные по визитам в магазины
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label>Водитель</Label>
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Все водители</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Магазин</Label>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Все магазины</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Дата от</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Дата до</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <SalesTable
        groups={groups}
        debts={debts}
        isAccountant={isAccountant}
        onDelete={loadData}
      />
    </div>
  )
}
