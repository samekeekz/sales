"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TrashIcon, CheckIcon, CreditCardIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { getStores } from "@/app/actions/stores"
import { getDebts, deleteDebt, recordPayment } from "@/app/actions/debts"
import { getPayments } from "@/app/actions/payments"
import { formatCurrency, getTotalOutstandingDebt } from "@/lib/calculations"
import type { DebtRecord, PaymentRecord, Store } from "@/lib/types"

function debtRemaining(debt: DebtRecord): number {
  return Math.max(0, debt.amount - (debt.paidAmount ?? 0))
}

export default function DebtsPage() {
  const { isAccountant } = useAuth()
  const router = useRouter()

  const [filterStore, setFilterStore] = useState("all")
  const [filterStatus, setFilterStatus] = useState<"all" | "unpaid" | "paid">("unpaid")
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")

  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payNote, setPayNote] = useState("")
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null)

  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([])

  useEffect(() => {
    if (!isAccountant) {
      router.push("/dashboard")
    }
  }, [isAccountant, router])

  const loadData = useCallback(async () => {
    const [d, s, p] = await Promise.all([getDebts(), getStores(), getPayments()])
    setDebts(d)
    setStores(s)
    setAllPayments(p)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const { filtered, totalOutstanding, storesWithDebt, paymentsByDebt } = useMemo(() => {
    const totalOutstanding = getTotalOutstandingDebt(debts)
    const storesWithDebt = new Set(
      debts.filter((d) => d.status === "unpaid").map((d) => d.storeId)
    ).size

    const paymentsByDebt = new Map<string, PaymentRecord[]>()
    for (const p of allPayments) {
      const list = paymentsByDebt.get(p.debtId) || []
      list.push(p)
      paymentsByDebt.set(p.debtId, list)
    }

    let filtered = debts
    if (filterStore !== "all") filtered = filtered.filter((d) => d.storeId === filterStore)
    if (filterStatus !== "all") filtered = filtered.filter((d) => d.status === filterStatus)
    if (filterFrom) filtered = filtered.filter((d) => d.deliveryDate >= filterFrom)
    if (filterTo) filtered = filtered.filter((d) => d.deliveryDate <= filterTo)

    filtered = [...filtered].sort((a, b) => {
      if (a.status !== b.status) return a.status === "unpaid" ? -1 : 1
      return b.deliveryDate.localeCompare(a.deliveryDate)
    })

    return { filtered, totalOutstanding, storesWithDebt, paymentsByDebt }
  }, [debts, allPayments, filterStore, filterStatus, filterFrom, filterTo])

  function openPayDialog(debt: DebtRecord) {
    setPayingDebt(debt)
    setPayAmount(debtRemaining(debt).toString())
    setPayNote("")
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payingDebt) return
    const amount = parseFloat(payAmount.replace(",", "."))
    const remaining = debtRemaining(payingDebt)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Введите корректную сумму")
      return
    }
    if (amount > remaining) {
      toast.error(`Сумма не может превышать остаток (${formatCurrency(remaining)})`)
      return
    }
    await recordPayment(payingDebt.id, amount, payNote.trim() || undefined)
    const fullyPaid = amount >= remaining
    toast.success(
      fullyPaid
        ? `Долг от «${payingDebt.storeName}» полностью погашен`
        : `Платёж ${formatCurrency(amount)} записан. Остаток: ${formatCurrency(remaining - amount)}`
    )
    setPayingDebt(null)
    await loadData()
  }

  async function handleDelete(id: string) {
    await deleteDebt(id)
    toast.success("Запись удалена")
    await loadData()
  }

  function toggleHistory(debtId: string) {
    setExpandedDebtId((prev) => (prev === debtId ? null : debtId))
  }

  if (!isAccountant) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Долги магазинов</h1>
        <p className="text-sm text-muted-foreground">
          Долги создаются автоматически при записи поставки
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Общий остаток долга
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {totalOutstanding > 0 ? formatCurrency(totalOutstanding) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">непогашенные остатки</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Магазинов с долгами
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${storesWithDebt > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {storesWithDebt > 0 ? storesWithDebt : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">из {stores.length} магазинов</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Все магазины" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все магазины</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unpaid">Не оплачен</SelectItem>
            <SelectItem value="paid">Оплачен</SelectItem>
            <SelectItem value="all">Все статусы</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="h-9 w-36 text-sm"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <Input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="h-9 w-36 text-sm"
          />
        </div>

        {(filterStore !== "all" || filterStatus !== "unpaid" || filterFrom || filterTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterStore("all")
              setFilterStatus("unpaid")
              setFilterFrom("")
              setFilterTo("")
            }}
          >
            Сбросить
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <CreditCardIcon className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {debts.length === 0 ? "Долги ещё не записаны" : "Нет записей по выбранным фильтрам"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата поставки</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead className="text-right">Остаток</TableHead>
                <TableHead className="text-center">Статус</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Оплачен</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((debt) => {
                const remaining = debtRemaining(debt)
                const isPartial = (debt.paidAmount ?? 0) > 0 && debt.status === "unpaid"
                const payments = paymentsByDebt.get(debt.id) ?? []
                const isExpanded = expandedDebtId === debt.id

                return (
                  <>
                    <TableRow
                      key={debt.id}
                      className={debt.status === "paid" ? "opacity-60" : ""}
                    >
                      <TableCell className="font-medium">
                        {new Date(debt.deliveryDate + "T00:00:00").toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>{debt.storeName}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${debt.status === "unpaid" ? "text-destructive" : "text-muted-foreground"}`}>
                          {formatCurrency(remaining)}
                        </span>
                        {isPartial && (
                          <span className="block text-xs text-muted-foreground">
                            из {formatCurrency(debt.amount)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {debt.status === "paid" ? (
                          <Badge variant="secondary">Оплачен</Badge>
                        ) : isPartial ? (
                          <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white">Частично</Badge>
                        ) : (
                          <Badge variant="destructive">Не оплачен</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right text-muted-foreground text-sm">
                        {debt.paidAt ? new Date(debt.paidAt).toLocaleDateString("ru-RU") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {payments.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 gap-0.5 text-xs text-muted-foreground"
                              onClick={() => toggleHistory(debt.id)}
                            >
                              {isExpanded ? (
                                <ChevronDownIcon className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRightIcon className="h-3.5 w-3.5" />
                              )}
                              {payments.length}
                            </Button>
                          )}
                          {debt.status === "unpaid" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-green-600"
                              onClick={() => openPayDialog(debt)}
                              title="Записать оплату"
                            >
                              <CheckIcon className="h-4 w-4" />
                              <span className="sr-only">Оплатить</span>
                            </Button>
                          )}
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
                                <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Запись о долге от{" "}
                                  {new Date(debt.deliveryDate + "T00:00:00").toLocaleDateString("ru-RU")}{" "}
                                  для &quot;{debt.storeName}&quot; на сумму {formatCurrency(debt.amount)}{" "}
                                  будет удалена вместе с историей платежей.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(debt.id)}>
                                  Удалить
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && payments.length > 0 && (
                      <TableRow key={`${debt.id}-history`} className="bg-muted/30">
                        <TableCell colSpan={6} className="py-2 px-6">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            История платежей
                          </p>
                          <div className="flex flex-col gap-1">
                            {payments
                              .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
                              .map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between text-sm py-0.5"
                                >
                                  <span className="text-muted-foreground">
                                    {new Date(p.paidAt).toLocaleDateString("ru-RU")}
                                    {p.note && <span className="ml-2 text-xs">— {p.note}</span>}
                                  </span>
                                  <span className="font-medium text-green-700 dark:text-green-400">
                                    +{formatCurrency(p.amount)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!payingDebt} onOpenChange={(open) => !open && setPayingDebt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Записать оплату</DialogTitle>
            <DialogDescription>
              {payingDebt && (
                <>
                  Магазин: <strong>{payingDebt.storeName}</strong>
                  {" · "}
                  Долг: {formatCurrency(payingDebt.amount)}
                  {(payingDebt.paidAmount ?? 0) > 0 && (
                    <>{" · "}Оплачено: {formatCurrency(payingDebt.paidAmount ?? 0)}</>
                  )}
                  {" · "}
                  Остаток: <strong>{formatCurrency(debtRemaining(payingDebt))}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {payingDebt && (
            <form onSubmit={handleRecordPayment}>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Сумма оплаты (тг)</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={debtRemaining(payingDebt)}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Максимум: {formatCurrency(debtRemaining(payingDebt))}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Примечание (необязательно)</Label>
                  <Input
                    placeholder="Наличные, перевод..."
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button type="button" variant="outline" onClick={() => setPayingDebt(null)}>
                  Отмена
                </Button>
                <Button type="submit">Записать</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
