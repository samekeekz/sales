"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { calculateCommission } from "@/lib/calculations"
import type { SaleRecord } from "@/lib/types"
import type { DeliveryItem } from "@/lib/storage"

function toSale(s: {
  id: string
  date: string
  driver_name: string
  store_id: string | null
  store_name: string | null
  product_id: string | null
  product_name: string | null
  delivery_id: string | null
  quantity: { toNumber(): number }
  unit_price: { toNumber(): number }
  total_amount: { toNumber(): number }
  commission: { toNumber(): number }
  commission_rate: { toNumber(): number }
  created_at: Date
}): SaleRecord {
  return {
    id: s.id,
    date: s.date,
    driverName: s.driver_name,
    storeId: s.store_id ?? undefined,
    storeName: s.store_name ?? undefined,
    productId: s.product_id ?? undefined,
    productName: s.product_name ?? undefined,
    deliveryId: s.delivery_id ?? undefined,
    quantity: s.quantity.toNumber(),
    unitPrice: s.unit_price.toNumber(),
    totalAmount: s.total_amount.toNumber(),
    commission: s.commission.toNumber(),
    commissionRate: s.commission_rate.toNumber(),
    createdAt: s.created_at.toISOString(),
  }
}

export async function getSales(): Promise<SaleRecord[]> {
  const rows = await prisma.sale_records.findMany({ orderBy: { created_at: "desc" } })
  return rows.map(toSale)
}

export async function addSale(sale: SaleRecord): Promise<void> {
  await prisma.sale_records.create({
    data: {
      id: sale.id,
      date: sale.date,
      driver_name: sale.driverName,
      store_id: sale.storeId ?? null,
      store_name: sale.storeName ?? null,
      product_id: sale.productId ?? null,
      product_name: sale.productName ?? null,
      delivery_id: sale.deliveryId ?? null,
      quantity: sale.quantity,
      unit_price: sale.unitPrice,
      total_amount: sale.totalAmount,
      commission: sale.commission,
      commission_rate: sale.commissionRate,
      created_at: new Date(sale.createdAt),
    },
  })
  revalidatePath("/dashboard")
}

export async function updateSale(id: string, updated: Partial<SaleRecord>): Promise<void> {
  await prisma.sale_records.update({
    where: { id },
    data: {
      ...(updated.date !== undefined && { date: updated.date }),
      ...(updated.quantity !== undefined && { quantity: updated.quantity }),
      ...(updated.unitPrice !== undefined && { unit_price: updated.unitPrice }),
      ...(updated.totalAmount !== undefined && { total_amount: updated.totalAmount }),
      ...(updated.commission !== undefined && { commission: updated.commission }),
    },
  })
  revalidatePath("/dashboard")
}

export async function deleteSale(id: string): Promise<void> {
  await prisma.sale_records.delete({ where: { id } })
  revalidatePath("/dashboard")
}

export async function deleteSalesByDeliveryId(deliveryId: string): Promise<void> {
  await prisma.sale_records.deleteMany({ where: { delivery_id: deliveryId } })
  revalidatePath("/dashboard")
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export async function addDelivery(params: {
  deliveryId: string
  date: string
  driverName: string
  storeId: string
  storeName: string
  items: DeliveryItem[]
}): Promise<void> {
  const { deliveryId, date, driverName, storeId, storeName, items } = params

  let totalDebtAmount = 0
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const totalAmount = item.quantity * item.unitPrice
      const commission = calculateCommission(totalAmount, item.commissionRate)
      totalDebtAmount += totalAmount

      await tx.sale_records.create({
        data: {
          id: generateId(),
          date,
          driver_name: driverName,
          store_id: storeId,
          store_name: storeName,
          product_id: item.productId,
          product_name: item.productName,
          delivery_id: deliveryId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_amount: totalAmount,
          commission,
          commission_rate: item.commissionRate,
          created_at: now,
        },
      })
    }

    await tx.debt_records.create({
      data: {
        id: generateId(),
        store_id: storeId,
        store_name: storeName,
        delivery_date: date,
        amount: totalDebtAmount,
        delivery_id: deliveryId,
        status: "unpaid",
        created_at: now,
      },
    })
  })

  revalidatePath("/dashboard")
}
