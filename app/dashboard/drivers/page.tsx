"use client"

import { useState, useMemo, useSyncExternalStore, useEffect } from "react"
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
import { PlusIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { getDrivers, getSales, addDriver, deleteDriver, generateId } from "@/lib/storage"
import { formatNumber, formatCurrency } from "@/lib/calculations"

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  return () => window.removeEventListener("storage", cb)
}

function getDriversSnapshot() {
  return localStorage.getItem("drivers") || "[]"
}

function getSalesSnapshot() {
  return localStorage.getItem("sales_records") || "[]"
}

function getServerSnapshot() {
  return "[]"
}

export default function DriversPage() {
  const { isAccountant } = useAuth()
  const router = useRouter()
  const [newName, setNewName] = useState("")

  useEffect(() => {
    if (!isAccountant) {
      router.push("/dashboard")
    }
  }, [isAccountant, router])

  const driversRaw = useSyncExternalStore(subscribe, getDriversSnapshot, getServerSnapshot)
  const salesRaw = useSyncExternalStore(subscribe, getSalesSnapshot, getServerSnapshot)

  const { drivers, driverStats } = useMemo(() => {
    const drivers = getDrivers()
    const sales = getSales()

    const stats = new Map<string, { totalQty: number; totalAmt: number; totalComm: number }>()
    for (const sale of sales) {
      const existing = stats.get(sale.driverName) || { totalQty: 0, totalAmt: 0, totalComm: 0 }
      existing.totalQty += sale.quantity
      existing.totalAmt += sale.totalAmount
      existing.totalComm += sale.commission
      stats.set(sale.driverName, existing)
    }

    return { drivers, driverStats: stats }
  }, [driversRaw, salesRaw])

  function handleAddDriver(e: React.FormEvent) {
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
    addDriver({
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
    })
    window.dispatchEvent(new Event("storage"))
    toast.success(`Водитель "${name}" добавлен`)
    setNewName("")
  }

  function handleDelete(id: string, name: string) {
    deleteDriver(id)
    window.dispatchEvent(new Event("storage"))
    toast.success(`Водитель "${name}" удалён`)
  }

  if (!isAccountant) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Водители</h1>
        <p className="text-sm text-muted-foreground">
          Управление списком водителей и их статистика
        </p>
      </div>

      <Card>
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

      {drivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">Водители ещё не добавлены</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead className="text-right">Всего продаж (ед.)</TableHead>
                <TableHead className="text-right">Сумма продаж</TableHead>
                <TableHead className="text-right">Комиссия</TableHead>
                <TableHead className="text-right">Добавлен</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => {
                const stats = driverStats.get(driver.name) || { totalQty: 0, totalAmt: 0, totalComm: 0 }
                return (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/drivers/${encodeURIComponent(driver.name)}`}
                        className="hover:underline"
                      >
                        {driver.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(stats.totalQty)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stats.totalAmt)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stats.totalComm)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(driver.createdAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <TrashIcon className="h-4 w-4" />
                            <span className="sr-only">Удалить</span>
                          </Button>
                        </AlertDialogTrigger>
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
