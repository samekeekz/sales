"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { TrashIcon } from "lucide-react"
import { toast } from "sonner"
import type { DeliveryGroup, DebtRecord } from "@/lib/types"
import { deleteSalesByDeliveryId, deleteDebtByDeliveryId, deleteSale } from "@/lib/storage"
import { formatNumber, formatCurrency } from "@/lib/calculations"

interface SalesTableProps {
  groups: DeliveryGroup[]
  debts: DebtRecord[]
  isAccountant: boolean
  onDelete?: () => void
}

export function SalesTable({ groups, debts, isAccountant, onDelete }: SalesTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(group: DeliveryGroup) {
    if (group.deliveryId && !group.deliveryId.startsWith("legacy_")) {
      deleteSalesByDeliveryId(group.deliveryId)
      deleteDebtByDeliveryId(group.deliveryId)
    } else {
      for (const item of group.items) {
        deleteSale(item.id)
      }
    }
    window.dispatchEvent(new Event("storage"))
    toast.success("Поставка удалена")
    setDeletingId(null)
    onDelete?.()
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <p className="text-sm text-muted-foreground">Нет записей о поставках</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Водитель</TableHead>
            <TableHead className="hidden sm:table-cell">Магазин</TableHead>
            <TableHead className="hidden md:table-cell">Товары</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Кол-во</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
            <TableHead className="hidden md:table-cell text-right">Комиссия</TableHead>
            <TableHead className="text-center">Долг</TableHead>
            {isAccountant && <TableHead className="w-10" />}
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
                <TableCell className="font-medium">{group.driverName}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {group.storeName ?? "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-55">
                  {group.items.length > 0
                    ? group.items
                        .map((item) => `${item.productName ?? "Товар"} × ${formatNumber(item.quantity)}`)
                        .join(", ")
                    : "—"}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right whitespace-nowrap">
                  {formatNumber(group.totalQuantity)} ед.
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatCurrency(group.totalAmount)}
                </TableCell>
                <TableCell className="hidden md:table-cell text-right whitespace-nowrap font-medium">
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
                {isAccountant && (
                  <TableCell>
                    <AlertDialog
                      open={deletingId === group.deliveryId}
                      onOpenChange={(open) => !open && setDeletingId(null)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingId(group.deliveryId)}
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span className="sr-only">Удалить</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить поставку?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Поставка в «{group.storeName ?? "—"}» для {group.driverName} за{" "}
                            {new Date(group.date + "T00:00:00").toLocaleDateString("ru-RU")} будет
                            удалена. Связанный долг магазина также будет удалён. Это действие нельзя
                            отменить.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(group)}>
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
