"use server"

import { prisma } from "@/lib/prisma"
import type { PaymentRecord } from "@/lib/types"

function toPayment(p: {
  id: string
  debt_id: string
  amount: { toNumber(): number }
  paid_at: string
  note: string | null
}): PaymentRecord {
  return {
    id: p.id,
    debtId: p.debt_id,
    amount: p.amount.toNumber(),
    paidAt: p.paid_at,
    note: p.note ?? undefined,
  }
}

export async function getPayments(): Promise<PaymentRecord[]> {
  const rows = await prisma.payment_records.findMany({ orderBy: { paid_at: "desc" } })
  return rows.map(toPayment)
}

export async function addPayment(payment: PaymentRecord): Promise<void> {
  await prisma.payment_records.create({
    data: {
      id: payment.id,
      debt_id: payment.debtId,
      amount: payment.amount,
      paid_at: payment.paidAt,
      note: payment.note ?? null,
    },
  })
}

export async function getPaymentsByDebtId(debtId: string): Promise<PaymentRecord[]> {
  const rows = await prisma.payment_records.findMany({
    where: { debt_id: debtId },
    orderBy: { paid_at: "desc" },
  })
  return rows.map(toPayment)
}
