"use client"

import { useMemo, useState, useSyncExternalStore, useCallback } from "react"
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
import { getSales, getDrivers, getDebts, getStores } from "@/lib/storage"
import { groupByDelivery } from "@/lib/calculations"

const ALL = "__all__"

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

export default function SalesPage() {
  const { isAccountant } = useAuth()
  const [driverFilter, setDriverFilter] = useState(ALL)
  const [storeFilter, setStoreFilter] = useState(ALL)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const salesRaw = useSyncExternalStore(subscribe, getSalesSnapshot, getServerSnapshot)
  const debtsRaw = useSyncExternalStore(subscribe, getDebtsSnapshot, getServerSnapshot)

  const { groups, debts, drivers, stores } = useMemo(() => {
    let allSales = getSales()
    const drivers = getDrivers()
    const stores = getStores()
    const debts = getDebts()

    // Filter individual records before grouping
    if (driverFilter !== ALL) {
      allSales = allSales.filter((s) => s.driverName === driverFilter)
    }
    if (dateFrom) {
      allSales = allSales.filter((s) => s.date >= dateFrom)
    }
    if (dateTo) {
      allSales = allSales.filter((s) => s.date <= dateTo)
    }

    let groups = groupByDelivery(allSales)

    // Store filter applies on groups
    if (storeFilter !== ALL) {
      groups = groups.filter((g) => g.storeId === storeFilter)
    }

    return { groups, debts, drivers, stores }
  }, [salesRaw, debtsRaw, driverFilter, storeFilter, dateFrom, dateTo])

  const refresh = useCallback(() => {
    window.dispatchEvent(new Event("storage"))
  }, [])

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
        onDelete={refresh}
      />
    </div>
  )
}
