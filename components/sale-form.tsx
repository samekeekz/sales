"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { MobileSelect } from "@/components/mobile-select"
import { PlusIcon, TrashIcon, StoreIcon } from "lucide-react"
import { toast } from "sonner"
import { getSales, addDelivery } from "@/app/actions/sales"
import { getDrivers, addDriver } from "@/app/actions/drivers"
import { getSettings } from "@/app/actions/settings"
import { getStores } from "@/app/actions/stores"
import { getActiveProducts } from "@/app/actions/products"
import type { Driver, Store, Product, SaleRecord } from "@/lib/types"
import {
  getCommissionRate,
  filterSalesByDateRange,
  getWeekRange,
  formatCurrency,
  formatNumber,
} from "@/lib/calculations"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

interface ProductLine {
  id: string
  productId: string
  quantity: string
}

interface StoreSection {
  id: string
  storeId: string
  lines: ProductLine[]
}

function makeDefaultSection(): StoreSection {
  return { id: generateId(), storeId: "", lines: [{ id: generateId(), productId: "", quantity: "" }] }
}

interface DeliveryItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  commissionRate: number
}

interface SaleFormProps {
  onSaleAdded?: () => void
}

const DEFAULT_SETTINGS = { commissionThreshold: 200, lowRate: 0.05, highRate: 0.07, commissionTiers: [] as { from: number; rate: number }[] }

export function SaleForm({ onSaleAdded }: SaleFormProps) {
  const [date, setDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [selectedDriver, setSelectedDriver] = useState("")
  const [newDriverName, setNewDriverName] = useState("")
  const [isAddingDriver, setIsAddingDriver] = useState(false)
  const [sections, setSections] = useState<StoreSection[]>([makeDefaultSection()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [allSales, setAllSales] = useState<SaleRecord[]>([])

  useEffect(() => {
    Promise.all([
      getDrivers(),
      getStores(),
      getActiveProducts(),
      getSettings(),
      getSales(),
    ]).then(([dr, st, pr, se, sa]) => {
      setDrivers(dr)
      setStores(st)
      setProducts(pr)
      setSettings(se)
      setAllSales(sa)
    })
  }, [])

  const driverName = isAddingDriver ? newDriverName.trim() : selectedDriver

  const weeklyQtyByProduct = useMemo(() => {
    if (!driverName) return new Map<string, number>()
    const { from, to } = getWeekRange()
    const weekSales = filterSalesByDateRange(allSales, from, to).filter(
      (s) => s.driverName === driverName
    )
    const map = new Map<string, number>()
    for (const sale of weekSales) {
      const key = sale.productId ?? "__legacy__"
      map.set(key, (map.get(key) || 0) + sale.quantity)
    }
    return map
  }, [driverName, allSales])

  const formQtyByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const sec of sections) {
      for (const line of sec.lines) {
        if (!line.productId) continue
        const qty = parseInt(line.quantity) || 0
        if (qty > 0) map.set(line.productId, (map.get(line.productId) || 0) + qty)
      }
    }
    return map
  }, [sections])

  const commissionPreview = useMemo(() => {
    let total = 0
    for (const [productId, formQty] of formQtyByProduct) {
      const product = products.find((p) => p.id === productId)
      if (!product) continue
      const weeklyQty = weeklyQtyByProduct.get(productId) || 0
      const totalQty = weeklyQty + formQty
      const rate = getCommissionRate(totalQty, settings)
      total += formQty * product.price * rate
    }
    return Math.floor(total / 10) * 10
  }, [formQtyByProduct, weeklyQtyByProduct, products, settings])

  const totalFormQty = Array.from(formQtyByProduct.values()).reduce((s, v) => s + v, 0)
  const totalFormAmount = useMemo(() => {
    let total = 0
    for (const [productId, qty] of formQtyByProduct) {
      const product = products.find((p) => p.id === productId)
      if (product) total += qty * product.price
    }
    return total
  }, [formQtyByProduct, products])

  function updateSection(sectionId: string, update: Partial<StoreSection>) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...update } : s)))
  }

  function updateLine(sectionId: string, lineId: string, update: Partial<ProductLine>) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, ...update } : l)) }
          : s
      )
    )
  }

  function addLine(sectionId: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, lines: [...s.lines, { id: generateId(), productId: "", quantity: "" }] }
          : s
      )
    )
  }

  function removeLine(sectionId: string, lineId: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, lines: s.lines.filter((l) => l.id !== lineId) } : s
      )
    )
  }

  function removeSection(sectionId: string) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId))
  }

  function addSection() {
    setSections((prev) => [...prev, makeDefaultSection()])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!driverName) { toast.error("Выберите или введите водителя"); return }

    const validSections = sections.filter(
      (s) => s.storeId && s.lines.some((l) => l.productId && parseInt(l.quantity) > 0)
    )
    if (validSections.length === 0) { toast.error("Добавьте хотя бы один магазин с товарами"); return }

    for (const sec of sections) {
      if (!sec.storeId) { toast.error("Выберите магазин для всех секций"); return }
      const hasItems = sec.lines.some((l) => l.productId && parseInt(l.quantity) > 0)
      if (!hasItems) { toast.error("Добавьте хотя бы один товар в каждый магазин"); return }
    }

    const storeIds = sections.map((s) => s.storeId)
    if (new Set(storeIds).size !== storeIds.length) {
      toast.error("Один магазин не может встречаться дважды"); return
    }

    setIsSubmitting(true)
    try {
      if (isAddingDriver && !drivers.find((d) => d.name === driverName)) {
        await addDriver({ id: generateId(), name: driverName, createdAt: new Date().toISOString() })
      }

      // Calculate per-product weekly quantities
      const { from, to } = getWeekRange()
      const weekSales = filterSalesByDateRange(allSales, from, to).filter(
        (s) => s.driverName === driverName
      )
      const existingQtyByProduct = new Map<string, number>()
      for (const sale of weekSales) {
        const key = sale.productId ?? "__legacy__"
        existingQtyByProduct.set(key, (existingQtyByProduct.get(key) || 0) + sale.quantity)
      }

      const formQtyBefore = new Map<string, number>()

      for (const sec of sections) {
        const store = stores.find((s) => s.id === sec.storeId)
        if (!store) continue

        const items: DeliveryItem[] = sec.lines
          .filter((l) => l.productId && parseInt(l.quantity) > 0)
          .flatMap((l) => {
            const product = products.find((p) => p.id === l.productId)
            if (!product) return []
            const qty = parseInt(l.quantity)
            const alreadyThisForm = formQtyBefore.get(l.productId) || 0
            const existingWeekly = existingQtyByProduct.get(l.productId) || 0
            const totalQty = existingWeekly + alreadyThisForm + qty
            const rate = getCommissionRate(totalQty, settings)
            formQtyBefore.set(l.productId, alreadyThisForm + qty)
            return [{
              productId: product.id,
              productName: product.name,
              quantity: qty,
              unitPrice: product.price,
              commissionRate: rate,
            }]
          })

        if (items.length === 0) continue

        await addDelivery({
          deliveryId: generateId(),
          date,
          driverName,
          storeId: store.id,
          storeName: store.name,
          items,
        })
      }

      toast.success(`Поставка записана: ${formatNumber(totalFormQty)} ед. для ${driverName}`)

      setSections([makeDefaultSection()])
      setSelectedDriver("")
      setNewDriverName("")
      setIsAddingDriver(false)
      onSaleAdded?.()
    } catch (err) {
      toast.error("Ошибка при сохранении поставки. Попробуйте снова.")
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Новая поставка</CardTitle>
            <CardDescription>
              Записать развоз товаров от водителя по магазинам
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Водитель</Label>
                {!isAddingDriver ? (
                  <div className="flex gap-2">
                    <MobileSelect
                      value={selectedDriver}
                      onValueChange={setSelectedDriver}
                      placeholder="Выберите водителя"
                      label="Водитель"
                      className="flex-1 min-w-0"
                      options={drivers.map((d) => ({ value: d.name, label: d.name }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setIsAddingDriver(true)}
                    >
                      Новый
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Имя нового водителя"
                      value={newDriverName}
                      onChange={(e) => setNewDriverName(e.target.value)}
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => { setIsAddingDriver(false); setNewDriverName("") }}
                    >
                      Отмена
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Дата</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {sections.map((sec, secIdx) => (
          <Card key={sec.id} className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <StoreIcon className="h-4 w-4 text-muted-foreground" />
                  Магазин {secIdx + 1}
                </div>
                {sections.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection(sec.id)}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <MobileSelect
                value={sec.storeId}
                onValueChange={(v) => updateSection(sec.id, { storeId: v })}
                placeholder="Выберите магазин"
                label="Магазин"
                options={
                  stores.length === 0
                    ? [{ value: "__empty__", label: 'Нет магазинов — добавьте в разделе "Магазины"', disabled: true }]
                    : stores.map((s) => ({ value: s.id, label: s.name }))
                }
              />

              <div className="flex flex-col gap-2">
                {sec.lines.map((line) => {
                  const product = products.find((p) => p.id === line.productId)
                  const qty = parseInt(line.quantity) || 0
                  const lineAmount = product ? qty * product.price : 0
                  return (
                    <div key={line.id} className="flex items-center gap-2">
                      <MobileSelect
                        value={line.productId}
                        onValueChange={(v) => updateLine(sec.id, line.id, { productId: v })}
                        placeholder="Товар"
                        label="Товар"
                        className="flex-1 min-w-0"
                        options={
                          products.length === 0
                            ? [{ value: "__empty__", label: 'Нет товаров — добавьте в разделе "Товары"', disabled: true }]
                            : products.map((p) => ({ value: p.id, label: `${p.name} — ${formatCurrency(p.price)}` }))
                        }
                      />
                      <Input
                        type="number"
                        min="1"
                        placeholder="Кол-во"
                        className="w-24"
                        value={line.quantity}
                        onChange={(e) => updateLine(sec.id, line.id, { quantity: e.target.value })}
                      />
                      {product && qty > 0 && (
                        <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                          {formatCurrency(lineAmount)}
                        </span>
                      )}
                      {sec.lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(sec.id, line.id)}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start gap-1 h-7 text-xs"
                onClick={() => addLine(sec.id)}
              >
                <PlusIcon className="h-3 w-3" />
                Добавить товар
              </Button>
            </CardContent>
          </Card>
        ))}

        <Button type="button" variant="outline" className="gap-2" onClick={addSection}>
          <StoreIcon className="h-4 w-4" />
          Добавить магазин
        </Button>

        {totalFormQty > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">Итого за поставку</span>
                  <span className="text-lg font-bold">
                    {formatNumber(totalFormQty)} ед. / {formatCurrency(totalFormAmount)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-sm text-muted-foreground">Комиссия водителя (~)</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(commissionPreview)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Сохраняем..." : "Записать поставку"}
        </Button>
      </div>
    </form>
  )
}
