"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, TrashIcon, StoreIcon } from "lucide-react"
import { toast } from "sonner"
import {
  getSales,
  getDrivers,
  getSettings,
  getStores,
  getActiveProducts,
  addDelivery,
  addDriver,
  generateId,
} from "@/lib/storage"
import {
  getCommissionRate,
  filterSalesByDateRange,
  getWeekRange,
  formatCurrency,
  formatNumber,
} from "@/lib/calculations"

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

interface SaleFormProps {
  onSaleAdded?: () => void
}

export function SaleForm({ onSaleAdded }: SaleFormProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [selectedDriver, setSelectedDriver] = useState("")
  const [newDriverName, setNewDriverName] = useState("")
  const [isAddingDriver, setIsAddingDriver] = useState(false)
  const [sections, setSections] = useState<StoreSection[]>([makeDefaultSection()])

  const settings = getSettings()
  const drivers = getDrivers()
  const stores = getStores()
  const products = getActiveProducts()

  const driverName = isAddingDriver ? newDriverName.trim() : selectedDriver

  // Weekly quantities per product for this driver (for commission preview)
  const weeklyQtyByProduct = useMemo(() => {
    if (!driverName) return new Map<string, number>()
    const allSales = getSales()
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
  }, [driverName])

  // Aggregate quantities from current form (all sections combined)
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

  // Total commission preview
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
    return Math.round(total * 100) / 100
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

  // Section helpers
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!driverName) { toast.error("Выберите или введите водителя"); return }

    // Validate sections
    const validSections = sections.filter((s) => s.storeId && s.lines.some((l) => l.productId && parseInt(l.quantity) > 0))
    if (validSections.length === 0) { toast.error("Добавьте хотя бы один магазин с товарами"); return }

    for (const sec of sections) {
      if (!sec.storeId) { toast.error("Выберите магазин для всех секций"); return }
      const hasItems = sec.lines.some((l) => l.productId && parseInt(l.quantity) > 0)
      if (!hasItems) { toast.error("Добавьте хотя бы один товар в каждый магазин"); return }
    }

    // Check for duplicate stores
    const storeIds = sections.map((s) => s.storeId)
    if (new Set(storeIds).size !== storeIds.length) { toast.error("Один магазин не может встречаться дважды"); return }

    // Add driver if new
    const currentDrivers = getDrivers()
    if (isAddingDriver && !currentDrivers.find((d) => d.name === driverName)) {
      addDriver({ id: generateId(), name: driverName, createdAt: new Date().toISOString() })
    }

    // Read fresh settings and products at save time
    const saveSettings = getSettings()
    const saveProducts = getActiveProducts()

    // Calculate per-product weekly quantities fresh
    const allSales = getSales()
    const { from, to } = getWeekRange()
    const weekSales = filterSalesByDateRange(allSales, from, to).filter((s) => s.driverName === driverName)
    const existingQtyByProduct = new Map<string, number>()
    for (const sale of weekSales) {
      const key = sale.productId ?? "__legacy__"
      existingQtyByProduct.set(key, (existingQtyByProduct.get(key) || 0) + sale.quantity)
    }

    // Accumulate quantities across sections (all magaz sections combined for rate calc)
    const formQtyBefore = new Map<string, number>() // running total across sections

    for (const sec of sections) {
      const store = stores.find((s) => s.id === sec.storeId)
      if (!store) continue

      const items = sec.lines
        .filter((l) => l.productId && parseInt(l.quantity) > 0)
        .map((l) => {
          const product = saveProducts.find((p) => p.id === l.productId)
          if (!product) return null
          const qty = parseInt(l.quantity)
          const alreadyThisForm = formQtyBefore.get(l.productId) || 0
          const existingWeekly = existingQtyByProduct.get(l.productId) || 0
          const totalQty = existingWeekly + alreadyThisForm + qty
          const rate = getCommissionRate(totalQty, saveSettings)
          formQtyBefore.set(l.productId, alreadyThisForm + qty)
          return {
            productId: product.id,
            productName: product.name,
            quantity: qty,
            unitPrice: product.price,
            commissionRate: rate,
          }
        })
        .filter(Boolean) as import("@/lib/storage").DeliveryItem[]

      if (items.length === 0) continue

      addDelivery({
        deliveryId: generateId(),
        date,
        driverName,
        storeId: store.id,
        storeName: store.name,
        items,
      })
    }

    window.dispatchEvent(new Event("storage"))
    toast.success(`Поставка записана: ${formatNumber(totalFormQty)} ед. для ${driverName}`)

    // Reset form
    setSections([makeDefaultSection()])
    setSelectedDriver("")
    setNewDriverName("")
    setIsAddingDriver(false)
    onSaleAdded?.()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">
        {/* Driver + Date */}
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
                    <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите водителя" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setIsAddingDriver(true)}>
                      Новый
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input placeholder="Имя нового водителя" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} autoFocus />
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setIsAddingDriver(false); setNewDriverName("") }}>
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

        {/* Store sections */}
        {sections.map((sec, secIdx) => (
          <Card key={sec.id} className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <StoreIcon className="h-4 w-4 text-muted-foreground" />
                  Магазин {secIdx + 1}
                </div>
                {sections.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeSection(sec.id)}>
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Select value={sec.storeId} onValueChange={(v) => updateSection(sec.id, { storeId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите магазин" />
                </SelectTrigger>
                <SelectContent>
                  {stores.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Нет магазинов — добавьте в разделе "Магазины"</SelectItem>
                  ) : (
                    stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>

              <div className="flex flex-col gap-2">
                {sec.lines.map((line, lineIdx) => {
                  const product = products.find((p) => p.id === line.productId)
                  const qty = parseInt(line.quantity) || 0
                  const lineAmount = product ? qty * product.price : 0
                  return (
                    <div key={line.id} className="flex items-center gap-2">
                      <Select value={line.productId} onValueChange={(v) => updateLine(sec.id, line.id, { productId: v })}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Товар" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.length === 0 ? (
                            <SelectItem value="__empty__" disabled>Нет товаров — добавьте в разделе "Товары"</SelectItem>
                          ) : (
                            products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} — {formatCurrency(p.price)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
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
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeLine(sec.id, line.id)}>
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              <Button type="button" variant="ghost" size="sm" className="self-start gap-1 h-7 text-xs" onClick={() => addLine(sec.id)}>
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

        {/* Summary */}
        {totalFormQty > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">Итого за поставку</span>
                  <span className="text-lg font-bold">{formatNumber(totalFormQty)} ед. / {formatCurrency(totalFormAmount)}</span>
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

        <Button type="submit" size="lg" className="w-full">
          Записать поставку
        </Button>
      </div>
    </form>
  )
}
