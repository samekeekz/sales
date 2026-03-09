"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PlusIcon, TrashIcon, ChevronRightIcon, MoreHorizontal as MoreHorizontalIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { getDrivers, addDriver, deleteDriver } from "@/app/actions/drivers"
import { getSales } from "@/app/actions/sales"
import type { Driver, SaleRecord } from "@/lib/types"
import { formatNumber, formatCurrency } from "@/lib/calculations"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export default function DriversPage() {
  const { isAccountant } = useAuth()
  const router = useRouter()
  const [newName, setNewName] = useState("")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])

  useEffect(() => {
    if (!isAccountant) {
      router.push("/dashboard")
    }
  }, [isAccountant, router])

  const loadData = useCallback(async () => {
    setStatus("loading")
    try {
      const [dr, s] = await Promise.all([getDrivers(), getSales()])
      setDrivers(dr)
      setSales(s)
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const driverStats = useMemo(() => {
    const stats = new Map<string, { totalQty: number; totalAmt: number; totalComm: number }>()
    for (const sale of sales) {
      const existing = stats.get(sale.driverName) || { totalQty: 0, totalAmt: 0, totalComm: 0 }
      existing.totalQty += sale.quantity
      existing.totalAmt += sale.totalAmount
      existing.totalComm += sale.commission
      stats.set(sale.driverName, existing)
    }
    return stats
  }, [sales])

  async function handleAddDriver(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      toast.error("Введите имя водителя")
      return
    }
    if (drivers.find((d) => d.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Водитель с таким именем уже существует")
      return
    }
    await addDriver({ id: generateId(), name, createdAt: new Date().toISOString() })
    toast.success(`Водитель "${name}" добавлен`)
    setNewName("")
    await loadData()
  }

  async function handleDelete(id: string, name: string) {
    await deleteDriver(id)
    toast.success(`Водитель "${name}" удалён`)
    await loadData()
  }

  if (!isAccountant) return null

  return (
    <div className="flex flex-col gap-4 h-[calc(100svh-5.5rem)] md:h-[calc(100svh-6.5rem)]">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Водители</h1>
        <p className="text-sm text-muted-foreground">
          Управление списком водителей и их статистика
        </p>
      </div>

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle className="text-base">Добавить водителя</CardTitle>
          <CardDescription>Добавьте нового водителя в систему</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDriver} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="driver-name" className="sr-only">Имя водителя</Label>
              <Input
                id="driver-name"
                placeholder="Имя водителя"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Button type="submit" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Добавить
            </Button>
          </form>
        </CardContent>
      </Card>

      {status === "loading" ? (
        <div className="flex flex-col gap-2 shrink-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="flex-1 min-h-0 flex flex-col items-center gap-3 rounded-lg border border-dashed text-center justify-center">
          <p className="text-sm text-muted-foreground">Не удалось загрузить список водителей</p>
          <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
        </div>
      ) : drivers.length === 0 ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">Водители ещё не добавлены</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead className="text-right">Всего продаж (ед.)</TableHead>
                <TableHead className="text-right">Сумма продаж</TableHead>
                <TableHead className="text-right">Комиссия</TableHead>
                <TableHead className="text-right">Добавлен</TableHead>
                <TableHead className="w-10 text-center text-xs text-muted-foreground">Отчёт</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => {
                const stats = driverStats.get(driver.name) || { totalQty: 0, totalAmt: 0, totalComm: 0 }
                return (
                  <TableRow key={driver.id} className="group">
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(stats.totalQty)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stats.totalAmt)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stats.totalComm)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(driver.createdAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/dashboard/drivers/${encodeURIComponent(driver.name)}`}>
                          <ChevronRightIcon className="h-4 w-4" />
                          <span className="sr-only">Отчёт по {driver.name}</span>
                        </Link>
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              aria-label={`Действия для водителя ${driver.name}`}
                            >
                              <MoreHorizontalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem variant="destructive">
                                <TrashIcon className="h-4 w-4" />
                                <span>Удалить</span>
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить водителя?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Водитель &quot;{driver.name}&quot; будет удалён из списка.
                              Записи о его продажах сохранятся.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(driver.id, driver.name)}>
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
