"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/multi-select"
import { SalesTable } from "@/components/sales-table"
import { Skeleton } from "@/components/ui/skeleton"
import { XIcon } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { getSales } from "@/app/actions/sales"
import { getDrivers } from "@/app/actions/drivers"
import { getDebts } from "@/app/actions/debts"
import { getStores } from "@/app/actions/stores"
import type { SaleRecord, Driver, DebtRecord, Store } from "@/lib/types"
import { groupByDelivery } from "@/lib/calculations"

export default function SalesPage() {
  const { isAccountant } = useAuth()
  const [driverFilter, setDriverFilter] = useState<string[]>([])
  const [storeFilter, setStoreFilter] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [stores, setStores] = useState<Store[]>([])

  const loadData = useCallback(async () => {
    setStatus("loading")
    try {
      const [s, d, dr, st] = await Promise.all([getSales(), getDebts(), getDrivers(), getStores()])
      setSales(s)
      setDebts(d)
      setDrivers(dr)
      setStores(st)
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const hasFilters = driverFilter.length > 0 || storeFilter.length > 0 || !!dateFrom || !!dateTo

  function resetFilters() {
    setDriverFilter([])
    setStoreFilter([])
    setDateFrom("")
    setDateTo("")
  }

  const groups = useMemo(() => {
    let filtered = sales
    if (driverFilter.length > 0) {
      filtered = filtered.filter((s) => driverFilter.includes(s.driverName))
    }
    if (dateFrom) {
      filtered = filtered.filter((s) => s.date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((s) => s.date <= dateTo)
    }

    let groups = groupByDelivery(filtered)
    if (storeFilter.length > 0) {
      groups = groups.filter((g) => storeFilter.includes(g.storeId ?? ""))
    }
    return groups
  }, [sales, driverFilter, storeFilter, dateFrom, dateTo])

  return (
    <div className="flex flex-col gap-4 h-[calc(100svh-5.5rem)] md:h-[calc(100svh-6.5rem)]">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">История поставок</h1>
        <p className="text-sm text-muted-foreground">
          Все записи о поставках сгруппированные по визитам в магазины
        </p>
      </div>

      <Card className="shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Фильтры</CardTitle>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={resetFilters}
              >
                <XIcon className="h-3 w-3" />
                Сбросить
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label>Водитель</Label>
              <MultiSelect
                values={driverFilter}
                onValuesChange={setDriverFilter}
                label="Водитель"
                allLabel="Все водители"
                options={drivers.map((d) => ({ value: d.name, label: d.name }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Магазин</Label>
              <MultiSelect
                values={storeFilter}
                onValuesChange={setStoreFilter}
                label="Магазин"
                allLabel="Все магазины"
                options={stores.map((s) => ({ value: s.id, label: s.name }))}
              />
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

      <div className="flex-1 min-h-0 overflow-auto">
        {status === "loading" ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">Не удалось загрузить поставки</p>
            <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
          </div>
        ) : (
          <SalesTable
            groups={groups}
            debts={debts}
            isAccountant={isAccountant}
            onDelete={loadData}
          />
        )}
      </div>
    </div>
  )
}
