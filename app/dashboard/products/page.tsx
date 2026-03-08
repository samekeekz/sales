"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { PlusIcon, PencilIcon, TrashIcon, RotateCcwIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { getProducts, addProduct, updateProduct, softDeleteProduct, restoreProduct } from "@/app/actions/products"
import type { Product } from "@/lib/types"
import { formatCurrency } from "@/lib/calculations"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export default function ProductsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()

  const [newName, setNewName] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [showDeleted, setShowDeleted] = useState(false)
  const [editProduct, setEditProduct] = useState<{ id: string; name: string; price: string } | null>(null)
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!isAdmin) router.push("/dashboard")
  }, [isAdmin, router])

  const loadData = useCallback(async () => {
    setStatus("loading")
    try {
      const all = await getProducts()
      setProducts(all)
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const { active, deleted } = useMemo(() => ({
    active: products.filter((p) => !p.isDeleted),
    deleted: products.filter((p) => p.isDeleted),
  }), [products])

  const displayed = showDeleted ? [...active, ...deleted] : active

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { toast.error("Введите название товара"); return }
    const price = parseFloat(newPrice.replace(",", "."))
    if (isNaN(price) || price <= 0) { toast.error("Введите корректную цену"); return }
    if (active.find((p) => p.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Товар с таким названием уже существует"); return
    }
    await addProduct({ id: generateId(), name, price, isDeleted: false, createdAt: new Date().toISOString() })
    toast.success(`Товар "${name}" добавлен`)
    setNewName("")
    setNewPrice("")
    await loadData()
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editProduct) return
    const name = editProduct.name.trim()
    if (!name) { toast.error("Введите название"); return }
    const price = parseFloat(editProduct.price.replace(",", "."))
    if (isNaN(price) || price <= 0) { toast.error("Введите корректную цену"); return }
    await updateProduct(editProduct.id, { name, price })
    toast.success("Товар обновлён")
    setEditProduct(null)
    await loadData()
  }

  async function handleDelete(id: string, name: string) {
    await softDeleteProduct(id)
    toast.success(`Товар "${name}" скрыт из форм (исторические данные сохранены)`)
    await loadData()
  }

  async function handleRestore(id: string, name: string) {
    await restoreProduct(id)
    toast.success(`Товар "${name}" восстановлён`)
    await loadData()
  }

  if (!isAdmin) return null

  return (
    <div className="flex flex-col gap-4 h-[calc(100svh-5.5rem)] md:h-[calc(100svh-6.5rem)]">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Товары</h1>
          <p className="text-sm text-muted-foreground">
            Виды продукции и цены (цена фиксируется в каждой поставке)
          </p>
        </div>
        {deleted.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowDeleted(!showDeleted)}>
            {showDeleted ? "Скрыть удалённые" : `Показать удалённые (${deleted.length})`}
          </Button>
        )}
      </div>

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle className="text-base">Добавить товар</CardTitle>
          <CardDescription>
            Цена за единицу фиксируется в каждой поставке — прошлые записи не меняются при изменении цены
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2 items-end">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>Название</Label>
              <Input placeholder="Твистер" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 w-36">
              <Label>Цена (тг)</Label>
              <Input type="number" min="0" step="0.01" placeholder="600" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
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
          <p className="text-sm text-muted-foreground">Не удалось загрузить список товаров</p>
          <Button variant="outline" size="sm" onClick={loadData}>Повторить</Button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">Товары ещё не добавлены</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="text-right">Текущая цена</TableHead>
                <TableHead className="text-right">Добавлен</TableHead>
                <TableHead className="text-center">Статус</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((product) => (
                <TableRow key={product.id} className={product.isDeleted ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(product.createdAt).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.isDeleted ? (
                      <Badge variant="outline" className="text-muted-foreground">Удалён</Badge>
                    ) : (
                      <Badge variant="secondary">Активен</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {product.isDeleted ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleRestore(product.id, product.name)}
                          title="Восстановить"
                        >
                          <RotateCcwIcon className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditProduct({ id: product.id, name: product.name, price: product.price.toString() })}
                            title="Редактировать"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title="Удалить (soft delete)"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Удалить товар?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Товар &quot;{product.name}&quot; будет скрыт из формы поставки. Все существующие записи поставок с этим товаром сохранятся.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(product.id, product.name)}>
                                  Удалить
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
            <DialogDescription>
              Изменение цены повлияет только на новые поставки. Прошлые записи сохраняют свою цену.
            </DialogDescription>
          </DialogHeader>
          {editProduct && (
            <form onSubmit={handleSaveEdit}>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Название</Label>
                  <Input value={editProduct.name} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Цена (тг)</Label>
                  <Input type="number" min="0" step="0.01" value={editProduct.price} onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button type="button" variant="outline" onClick={() => setEditProduct(null)}>Отмена</Button>
                <Button type="submit">Сохранить</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
