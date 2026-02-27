"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { DebtRecord } from "@/lib/types"

function toDebt(d: {
  id: string
  store_id: string
  store_name: string
  delivery_date: string
  amount: { toNumber(): number }
  delivery_id: string | null
  note: string | null
  status: string
  paid_amount: { toNumber(): number } | null
  paid_at: string | null
  created_at: Date
}): DebtRecord {
  return {
    id: d.id,
    storeId: d.store_id,
    storeName: d.store_name,
    deliveryDate: d.delivery_date,
    amount: d.amount.toNumber(),
    deliveryId: d.delivery_id ?? undefined,
    note: d.note ?? undefined,
    status: d.status as "unpaid" | "paid",
    paidAmount: d.paid_amount?.toNumber(),
    paidAt: d.paid_at ?? undefined,
    createdAt: d.created_at.toISOString(),
  }
}

export async function getDebts(): Promise<DebtRecord[]> {
  const rows = await prisma.debt_records.findMany({ orderBy: { created_at: "desc" } })
  return rows.map(toDebt)
}

export async function addDebt(debt: DebtRecord): Promise<void> {
  await prisma.debt_records.create({
    data: {
      id: debt.id,
      store_id: debt.storeId,
      store_name: debt.storeName,
      delivery_date: debt.deliveryDate,
      amount: debt.amount,
      delivery_id: debt.deliveryId ?? null,
      note: debt.note ?? null,
      status: debt.status,
      paid_amount: debt.paidAmount ?? null,
      paid_at: debt.paidAt ?? null,
      created_at: new Date(debt.createdAt),
    },
  })
  revalidatePath("/dashboard")
}

export async function updateDebt(id: string, updated: Partial<DebtRecord>): Promise<void> {
  await prisma.debt_records.update({
    where: { id },
    data: {
      ...(updated.status !== undefined && { status: updated.status }),
      ...(updated.paidAmount !== undefined && { paid_amount: updated.paidAmount }),
      ...(updated.paidAt !== undefined && { paid_at: updated.paidAt }),
      ...(updated.note !== undefined && { note: updated.note }),
    },
  })
  revalidatePath("/dashboard")
}

export async function deleteDebt(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.payment_records.deleteMany({ where: { debt_id: id } }),
    prisma.debt_records.delete({ where: { id } }),
  ])
  revalidatePath("/dashboard")
}

export async function deleteDebtByDeliveryId(deliveryId: string): Promise<void> {
  const debts = await prisma.debt_records.findMany({ where: { delivery_id: deliveryId }, select: { id: true } })
  const ids = debts.map((d) => d.id)
  if (ids.length > 0) {
    await prisma.$transaction([
      prisma.payment_records.deleteMany({ where: { debt_id: { in: ids } } }),
      prisma.debt_records.deleteMany({ where: { delivery_id: deliveryId } }),
    ])
  }
  revalidatePath("/dashboard")
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export async function recordPayment(debtId: string, amount: number, note?: string): Promise<void> {
  const debt = await prisma.debt_records.findUnique({ where: { id: debtId } })
  if (!debt) return

  const newPaid = (debt.paid_amount?.toNumber() ?? 0) + amount
  const fullyPaid = newPaid >= debt.amount.toNumber()

  await prisma.$transaction([
    prisma.payment_records.create({
      data: {
        id: generateId(),
        debt_id: debtId,
        amount,
        paid_at: new Date().toISOString(),
        note: note ?? null,
      },
    }),
    prisma.debt_records.update({
      where: { id: debtId },
      data: {
        paid_amount: newPaid,
        ...(fullyPaid ? { status: "paid", paid_at: new Date().toISOString() } : {}),
      },
    }),
  ])

  revalidatePath("/dashboard")
}
