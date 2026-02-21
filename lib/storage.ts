import type { SaleRecord, Driver, AppSettings, AccountantUser, Store, DebtRecord, Product, PaymentRecord } from "./types"
import { calculateCommission } from "./calculations"

const KEYS = {
  sales: "sales_records",
  drivers: "drivers",
  settings: "app_settings",
  stores: "stores",
  debts: "debt_records",
  products: "products",
  payments: "payment_records",
} as const

const DEFAULT_SETTINGS: AppSettings = {
  adminPassword: "admin",
  accountants: [],
  commissionThreshold: 200,
  lowRate: 0.05,
  highRate: 0.07,
}

// Migrate old settings format
function migrateSettings(raw: AppSettings & { accountantPassword?: string; unitPrice?: number }): AppSettings {
  const result = { ...raw } as Record<string, unknown>

  // Remove deprecated unitPrice field
  delete result.unitPrice

  // Migrate old accountantPassword → adminPassword
  if (result.accountantPassword && !result.adminPassword) {
    result.adminPassword = result.accountantPassword || "admin"
    result.accountants = []
  }
  delete result.accountantPassword

  if (!result.accountants) result.accountants = []

  return { ...DEFAULT_SETTINGS, ...(result as Partial<AppSettings>) } as AppSettings
}

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export function getSales(): SaleRecord[] {
  return getItem<SaleRecord[]>(KEYS.sales, [])
}

export function addSale(sale: SaleRecord): void {
  const sales = getSales()
  sales.push(sale)
  setItem(KEYS.sales, sales)
}

export function updateSale(id: string, updated: Partial<SaleRecord>): void {
  const sales = getSales()
  const idx = sales.findIndex((s) => s.id === id)
  if (idx !== -1) {
    sales[idx] = { ...sales[idx], ...updated }
    setItem(KEYS.sales, sales)
  }
}

export function deleteSale(id: string): void {
  const sales = getSales().filter((s) => s.id !== id)
  setItem(KEYS.sales, sales)
}

export function deleteSalesByDeliveryId(deliveryId: string): void {
  const sales = getSales().filter((s) => s.deliveryId !== deliveryId)
  setItem(KEYS.sales, sales)
}

// ─── Atomic delivery ──────────────────────────────────────────────────────────
// Creates SaleRecord per product line + one DebtRecord for the store visit

export interface DeliveryItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  commissionRate: number
}

export function addDelivery(params: {
  deliveryId: string
  date: string
  driverName: string
  storeId: string
  storeName: string
  items: DeliveryItem[]
}): void {
  const { deliveryId, date, driverName, storeId, storeName, items } = params

  let totalDebtAmount = 0

  for (const item of items) {
    const totalAmount = item.quantity * item.unitPrice
    const commission = calculateCommission(totalAmount, item.commissionRate)
    addSale({
      id: generateId(),
      date,
      driverName,
      storeId,
      storeName,
      productId: item.productId,
      productName: item.productName,
      deliveryId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount,
      commission,
      commissionRate: item.commissionRate,
      createdAt: new Date().toISOString(),
    })
    totalDebtAmount += totalAmount
  }

  addDebt({
    id: generateId(),
    storeId,
    storeName,
    deliveryDate: date,
    amount: totalDebtAmount,
    deliveryId,
    status: "unpaid",
    createdAt: new Date().toISOString(),
  })
}

// ─── Drivers ──────────────────────────────────────────────────────────────────

export function getDrivers(): Driver[] {
  return getItem<Driver[]>(KEYS.drivers, [])
}

export function addDriver(driver: Driver): void {
  const drivers = getDrivers()
  drivers.push(driver)
  setItem(KEYS.drivers, drivers)
}

export function deleteDriver(id: string): void {
  const drivers = getDrivers().filter((d) => d.id !== id)
  setItem(KEYS.drivers, drivers)
}

export function updateDriver(id: string, updated: Partial<Driver>): void {
  const drivers = getDrivers()
  const idx = drivers.findIndex((d) => d.id === id)
  if (idx !== -1) {
    drivers[idx] = { ...drivers[idx], ...updated }
    setItem(KEYS.drivers, drivers)
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSettings(): AppSettings {
  const raw = getItem<AppSettings>(KEYS.settings, DEFAULT_SETTINGS)
  return migrateSettings(raw)
}

export function updateSettings(updates: Partial<AppSettings>): void {
  const current = getSettings()
  setItem(KEYS.settings, { ...current, ...updates })
}

// ─── Accountants ──────────────────────────────────────────────────────────────

export function addAccountant(accountant: AccountantUser): void {
  const settings = getSettings()
  settings.accountants.push(accountant)
  setItem(KEYS.settings, settings)
}

export function deleteAccountant(id: string): void {
  const settings = getSettings()
  settings.accountants = settings.accountants.filter((a) => a.id !== id)
  setItem(KEYS.settings, settings)
}

export function updateAccountant(id: string, updates: Partial<AccountantUser>): void {
  const settings = getSettings()
  const idx = settings.accountants.findIndex((a) => a.id === id)
  if (idx !== -1) {
    settings.accountants[idx] = { ...settings.accountants[idx], ...updates }
    setItem(KEYS.settings, settings)
  }
}

// ─── Stores ───────────────────────────────────────────────────────────────────

export function getStores(): Store[] {
  return getItem<Store[]>(KEYS.stores, [])
}

export function addStore(store: Store): void {
  const stores = getStores()
  stores.push(store)
  setItem(KEYS.stores, stores)
}

export function updateStore(id: string, updated: Partial<Store>): void {
  const stores = getStores()
  const idx = stores.findIndex((s) => s.id === id)
  if (idx !== -1) {
    stores[idx] = { ...stores[idx], ...updated }
    setItem(KEYS.stores, stores)
  }
}

export function deleteStore(id: string): void {
  const stores = getStores().filter((s) => s.id !== id)
  setItem(KEYS.stores, stores)
}

// ─── Debt Records ─────────────────────────────────────────────────────────────

export function getDebts(): DebtRecord[] {
  return getItem<DebtRecord[]>(KEYS.debts, [])
}

export function addDebt(debt: DebtRecord): void {
  const debts = getDebts()
  debts.push(debt)
  setItem(KEYS.debts, debts)
}

export function updateDebt(id: string, updated: Partial<DebtRecord>): void {
  const debts = getDebts()
  const idx = debts.findIndex((d) => d.id === id)
  if (idx !== -1) {
    debts[idx] = { ...debts[idx], ...updated }
    setItem(KEYS.debts, debts)
  }
}

export function deleteDebt(id: string): void {
  const debts = getDebts().filter((d) => d.id !== id)
  setItem(KEYS.debts, debts)
}

export function deleteDebtByDeliveryId(deliveryId: string): void {
  const debts = getDebts().filter((d) => d.deliveryId !== deliveryId)
  setItem(KEYS.debts, debts)
}

export function recordPayment(debtId: string, amount: number, note?: string): void {
  addPayment({ id: generateId(), debtId, amount, paidAt: new Date().toISOString(), note })
  const debt = getDebts().find((d) => d.id === debtId)
  if (!debt) return
  const newPaid = (debt.paidAmount ?? 0) + amount
  const fullyPaid = newPaid >= debt.amount
  updateDebt(debtId, {
    paidAmount: newPaid,
    ...(fullyPaid ? { status: "paid", paidAt: new Date().toISOString() } : {}),
  })
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function getPayments(): PaymentRecord[] {
  return getItem<PaymentRecord[]>(KEYS.payments, [])
}

export function addPayment(payment: PaymentRecord): void {
  const payments = getPayments()
  payments.push(payment)
  setItem(KEYS.payments, payments)
}

export function getPaymentsByDebtId(debtId: string): PaymentRecord[] {
  return getPayments().filter((p) => p.debtId === debtId)
}

// ─── Products ─────────────────────────────────────────────────────────────────

export function getProducts(): Product[] {
  return getItem<Product[]>(KEYS.products, [])
}

export function getActiveProducts(): Product[] {
  return getProducts().filter((p) => !p.isDeleted)
}

export function addProduct(product: Product): void {
  const products = getProducts()
  products.push(product)
  setItem(KEYS.products, products)
}

export function updateProduct(id: string, updated: Partial<Product>): void {
  const products = getProducts()
  const idx = products.findIndex((p) => p.id === id)
  if (idx !== -1) {
    products[idx] = { ...products[idx], ...updated }
    setItem(KEYS.products, products)
  }
}

export function softDeleteProduct(id: string): void {
  updateProduct(id, { isDeleted: true })
}

export function restoreProduct(id: string): void {
  updateProduct(id, { isDeleted: false })
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}
