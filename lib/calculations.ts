import type { SaleRecord, DriverSummary, DebtRecord, DebtSummary, DeliveryGroup, CommissionTier } from "./types"

type CommissionSettings = {
  commissionThreshold: number
  lowRate: number
  highRate: number
  commissionTiers?: CommissionTier[]
}

export function getCommissionRate(totalQuantity: number, settings: CommissionSettings): number {
  const tiers = settings.commissionTiers
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => b.from - a.from)
    const match = sorted.find((t) => totalQuantity >= t.from)
    return match ? match.rate : sorted[sorted.length - 1].rate
  }
  return totalQuantity >= settings.commissionThreshold ? settings.highRate : settings.lowRate
}

// Commission is rounded down to the nearest 10 tenge
export function calculateCommission(amount: number, rate: number): number {
  return Math.floor(amount * rate / 10) * 10
}

// Per-product commission: each product type has its own quantity → rate → commission
export function getDriverSummaries(sales: SaleRecord[], settings: CommissionSettings): DriverSummary[] {
  // Group all sales by driver
  const byDriver = new Map<string, SaleRecord[]>()
  for (const sale of sales) {
    const list = byDriver.get(sale.driverName) || []
    list.push(sale)
    byDriver.set(sale.driverName, list)
  }

  const summaries: DriverSummary[] = []

  for (const [driverName, driverSales] of byDriver) {
    // Group by productId (or "legacy" for old records without productId)
    const byProduct = new Map<string, SaleRecord[]>()
    for (const sale of driverSales) {
      const key = sale.productId ?? "__legacy__"
      const list = byProduct.get(key) || []
      list.push(sale)
      byProduct.set(key, list)
    }

    const breakdown: DriverSummary["productBreakdown"] = []
    let totalQuantity = 0
    let totalAmount = 0
    let totalCommission = 0
    let maxRate = 0

    for (const [, productSales] of byProduct) {
      const qty = productSales.reduce((s, r) => s + r.quantity, 0)
      const amt = productSales.reduce((s, r) => s + r.totalAmount, 0)
      const rate = getCommissionRate(qty, settings)
      const comm = calculateCommission(amt, rate)
      const name = productSales[0].productName ?? "Товар"

      breakdown.push({ productName: name, quantity: qty, amount: amt, commissionRate: rate, commission: comm })
      totalQuantity += qty
      totalAmount += amt
      totalCommission += comm
      if (rate > maxRate) maxRate = rate
    }

    // progressToThreshold: progress of leading product toward the next commission tier
    const maxQty = breakdown.reduce((m, b) => Math.max(m, b.quantity), 0)
    const tiers = settings.commissionTiers
    let nextTierFrom: number | null = null
    if (tiers && tiers.length > 0) {
      const sorted = [...tiers].sort((a, b) => a.from - b.from)
      const next = sorted.find((t) => t.from > maxQty)
      nextTierFrom = next ? next.from : null
    } else {
      nextTierFrom = maxQty < settings.commissionThreshold ? settings.commissionThreshold : null
    }
    const progressToThreshold = nextTierFrom
      ? Math.min((maxQty / nextTierFrom) * 100, 100)
      : 100

    summaries.push({
      driverName,
      totalQuantity,
      totalAmount,
      totalCommission,
      commissionRate: maxRate,
      progressToThreshold,
      productBreakdown: breakdown.sort((a, b) => b.quantity - a.quantity),
    })
  }

  return summaries.sort((a, b) => b.totalQuantity - a.totalQuantity)
}

// Group SaleRecords by deliveryId for display in history
export function groupByDelivery(sales: SaleRecord[]): DeliveryGroup[] {
  const byDelivery = new Map<string, SaleRecord[]>()
  const legacyKey = (sale: SaleRecord) => `legacy_${sale.driverName}_${sale.date}_${sale.id}`

  for (const sale of sales) {
    const key = sale.deliveryId ?? legacyKey(sale)
    const list = byDelivery.get(key) || []
    list.push(sale)
    byDelivery.set(key, list)
  }

  const groups: DeliveryGroup[] = []
  for (const [deliveryId, items] of byDelivery) {
    const first = items[0]
    groups.push({
      deliveryId,
      date: first.date,
      driverName: first.driverName,
      storeId: first.storeId,
      storeName: first.storeName,
      items,
      totalQuantity: items.reduce((s, r) => s + r.quantity, 0),
      totalAmount: items.reduce((s, r) => s + r.totalAmount, 0),
      totalCommission: items.reduce((s, r) => s + r.commission, 0),
    })
  }

  return groups.sort((a, b) => b.date.localeCompare(a.date) || b.deliveryId.localeCompare(a.deliveryId))
}

export function filterSalesByDateRange(sales: SaleRecord[], from: Date, to: Date): SaleRecord[] {
  const fromStr = from.toISOString().split("T")[0]
  const toStr = to.toISOString().split("T")[0]
  return sales.filter((s) => s.date >= fromStr && s.date <= toStr)
}

export function getWeekRange(): { from: Date; to: Date } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const from = new Date(now)
  from.setDate(now.getDate() - diff)
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

export function getMonthRange(): { from: Date; to: Date } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("ru-RU").format(num)
}

export function formatCurrency(num: number): string {
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num) + " тг"
  )
}

export function getDebtSummaries(debts: DebtRecord[]): DebtSummary[] {
  const unpaid = debts.filter((d) => d.status === "unpaid")
  const grouped = new Map<string, DebtRecord[]>()
  for (const debt of unpaid) {
    const list = grouped.get(debt.storeId) || []
    list.push(debt)
    grouped.set(debt.storeId, list)
  }
  const summaries: DebtSummary[] = []
  for (const [storeId, storeDebts] of grouped) {
    const totalDebt = storeDebts.reduce((s, d) => s + (d.amount - (d.paidAmount ?? 0)), 0)
    const dates = storeDebts.map((d) => d.deliveryDate).sort()
    summaries.push({
      storeId,
      storeName: storeDebts[0].storeName,
      totalDebt,
      unpaidCount: storeDebts.length,
      oldestUnpaidDate: dates[0] ?? null,
    })
  }
  return summaries.sort((a, b) => {
    if (!a.oldestUnpaidDate) return 1
    if (!b.oldestUnpaidDate) return -1
    return a.oldestUnpaidDate.localeCompare(b.oldestUnpaidDate)
  })
}

export function getTotalOutstandingDebt(debts: DebtRecord[]): number {
  return debts
    .filter((d) => d.status === "unpaid")
    .reduce((s, d) => s + (d.amount - (d.paidAmount ?? 0)), 0)
}

export function filterDebtsByDateRange(debts: DebtRecord[], from: Date, to: Date): DebtRecord[] {
  const fromStr = from.toISOString().split("T")[0]
  const toStr = to.toISOString().split("T")[0]
  return debts.filter((d) => d.deliveryDate >= fromStr && d.deliveryDate <= toStr)
}

export function exportToCSV(summaries: DriverSummary[], periodLabel: string): void {
  const headers = ["Водитель", "Товар", "Кол-во (ед.)", "Сумма", "Ставка", "Комиссия"]
  const rows: string[][] = []

  for (const s of summaries) {
    if (s.productBreakdown.length === 0) {
      rows.push([s.driverName, "—", s.totalQuantity.toString(), s.totalAmount.toFixed(2), `${(s.commissionRate * 100).toFixed(0)}%`, s.totalCommission.toFixed(2)])
    } else {
      for (const p of s.productBreakdown) {
        rows.push([s.driverName, p.productName, p.quantity.toString(), p.amount.toFixed(2), `${(p.commissionRate * 100).toFixed(0)}%`, p.commission.toFixed(2)])
      }
      rows.push([s.driverName, "ИТОГО", s.totalQuantity.toString(), s.totalAmount.toFixed(2), "", s.totalCommission.toFixed(2)])
    }
  }

  const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n")
  const BOM = "\uFEFF"
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `отчет_${periodLabel}_${new Date().toISOString().split("T")[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
