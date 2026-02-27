export interface Product {
  id: string
  name: string
  price: number       // текущая цена за единицу
  isDeleted: boolean  // soft delete — скрыт из форм, но продажи сохраняются
  createdAt: string
}

export interface SaleRecord {
  id: string
  date: string
  driverName: string
  // per-product delivery fields (optional for backward compat with old records)
  storeId?: string
  storeName?: string     // денормализован
  productId?: string
  productName?: string   // денормализован
  deliveryId?: string    // группирует строки одного визита в магазин
  quantity: number
  unitPrice: number      // цена за единицу на момент поставки
  totalAmount: number
  commission: number
  commissionRate: number
  createdAt: string
}

export interface Driver {
  id: string
  name: string
  createdAt: string
}

export interface AccountantUser {
  id: string
  name: string
  password: string
  createdAt: string
}

export interface AppSettings {
  // unitPrice removed — replaced by per-product pricing
  adminPassword: string
  accountants: AccountantUser[]
  commissionThreshold: number
  lowRate: number
  highRate: number
}

export type UserRole = "admin" | "accountant"

export interface DateRange {
  from: Date
  to: Date
}

export interface DriverSummary {
  driverName: string
  totalQuantity: number
  totalAmount: number
  totalCommission: number
  commissionRate: number      // максимальная ставка среди всех товаров (для Badge)
  progressToThreshold: number // прогресс самого популярного товара
  productBreakdown: Array<{   // детали по видам товаров
    productName: string
    quantity: number
    amount: number
    commissionRate: number
    commission: number
  }>
}

export interface DeliveryGroup {
  deliveryId: string
  date: string
  driverName: string
  storeId?: string
  storeName?: string
  items: SaleRecord[]
  totalQuantity: number
  totalAmount: number
  totalCommission: number
}

export interface Store {
  id: string
  name: string
  address?: string
  contactPhone?: string
  createdAt: string
}

export interface DebtRecord {
  id: string
  storeId: string
  storeName: string
  deliveryDate: string
  amount: number
  deliveryId?: string    // связывает с группой SaleRecord
  note?: string
  status: "unpaid" | "paid"
  paidAmount?: number    // суммарно оплачено; остаток = amount - paidAmount
  paidAt?: string        // дата полного погашения
  createdAt: string
}

export interface PaymentRecord {
  id: string
  debtId: string
  amount: number    // сумма этого конкретного платежа
  paidAt: string    // ISO timestamp
  note?: string
}

export interface DebtSummary {
  storeId: string
  storeName: string
  totalDebt: number
  unpaidCount: number
  oldestUnpaidDate: string | null
}
