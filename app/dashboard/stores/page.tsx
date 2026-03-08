"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { getStores, addStore, deleteStore } from "@/app/actions/stores"
import { getDebts } from "@/app/actions/debts"
import type { Store, DebtRecord } from "@/lib/types"
import { formatCurrency } from "@/lib/calculations"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export default function StoresPage() {
  const { isAccountant } = useAuth()
  const router = useRouter()
  const [newName, setNewName] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [stores, setStores] = useState<Store[]>([])
  const [debts, setDebts] = useState<DebtRecord[]>([])

  useEffect(() => {
    if (!isAccountant) {
      router.push("/dashboard")
    }
  }, [isAccountant, router])

  const loadData = useCallback(async () => {
    setStatus("loading")
    try {
      const [s, d] = await Promise.all([getStores(), getDebts()])
      setStores(s)
      setDebts(d)
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const storeDebtStats = useMemo(() => {
    const stats = new Map<string, { totalDebt: number; unpaidCount: number }>()
    for (const debt of debts) {
      if (debt.status === "unpaid") {
        const existing = stats.get(debt.storeId) || { totalDebt: 0, unpaidCount: 0 }
        existing.totalDebt += debt.amount
        existing.unpaidCount += 1
        stats.set(debt.storeId, existing)
      }
    }
    return stats
  }, [debts])

  async function handleAddStore(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      toast.error("Введите название магазина")
      return
    }
    if (stores.find((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Магазин с таким названием уже существует")
      return
    }
    await addStore({
      id: generateId(),
      name,
      address: newAddress.trim() || undefined,
      contactPhone: newPhone.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    toast.success(`Магазин "${name}" добавлен`)
    setNewName("")
    setNewAddress("")
    setNewPhone("")
    await loadData()
  }

  async function handleDeleteStore(id: string, name: string) {
    const stats = storeDebtStats.get(id)
    if (stats && stats.unpaidCount > 0) {
      toast.error(
        `Нельзя удалить: у магазина "${name}" есть непогашенные долги (${stats.unpaidCount} шт.)`
      )
      return
    }
    await deleteStore(id)
    toast.success(`Магазин "${name}" удалён`)
    await loadData()
  }

  if (!isAccountant) return null

  return (
    <div className="flex flex-col gap-4 h-[calc(100svh-5.5rem)] md:h-[calc(100svh-6.5rem)]">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Магазины</h1>
        <p className="text-sm text-muted-foreground">
          Управление списком магазинов и учёт долгов
        </p>
      </div>

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle className="text-base">Добавить магазин</CardTitle>
          <CardDescription>Добавьте новый магазин в систему</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddStore} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 min-w-0">
              <Input
                placeholder="Название магазина *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                placeholder="Адрес (необязательно)"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                placeholder="Телефон (необязательно)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <Button type="submit" className="gap-2 shrink-0">
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
          <p className="text-sm text-muted-foreground">Не удалось загрузить список магазинов</p>
          <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
        </div>
      ) : stores.length === 0 ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">Магазины ещё не добавлены</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="hidden sm:table-cell">Адрес</TableHead>
                <TableHead className="hidden md:table-cell">Телефон</TableHead>
                <TableHead className="text-right">Текущий долг</TableHead>
                <TableHead className="text-right">Долгов</TableHead>
                <TableHead className="text-right">Добавлен</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((store) => {
                const stats = storeDebtStats.get(store.id) || { totalDebt: 0, unpaidCount: 0 }
                return (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {store.address || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {store.contactPhone || "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        stats.totalDebt > 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {stats.totalDebt > 0 ? formatCurrency(stats.totalDebt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {stats.unpaidCount > 0 ? (
                        <Badge variant="destructive">{stats.unpaidCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(store.createdAt).toLocaleDateString("ru-RU")}
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
                            <AlertDialogTitle>Удалить магазин?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {storeDebtStats.get(store.id)?.unpaidCount
                                ? `У магазина "${store.name}" есть непогашенные долги. Сначала закройте все долги.`
                                : `Магазин "${store.name}" будет удалён из системы. История долгов сохранится.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteStore(store.id, store.name)}
                              className={
                                storeDebtStats.get(store.id)?.unpaidCount
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }
                            >
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
