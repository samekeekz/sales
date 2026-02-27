"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { AppSettings } from "@/lib/types"

const DEFAULT_SETTINGS: AppSettings = {
  adminPassword: "",
  accountants: [],
  commissionThreshold: 200,
  lowRate: 0.05,
  highRate: 0.07,
}

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.app_settings.findUnique({ where: { id: 1 } })
  if (!row) return DEFAULT_SETTINGS
  return {
    adminPassword: row.admin_password,
    accountants: [],
    commissionThreshold: row.commission_threshold.toNumber(),
    lowRate: row.low_rate.toNumber(),
    highRate: row.high_rate.toNumber(),
  }
}

export async function updateSettings(updates: Partial<Omit<AppSettings, "accountants">>): Promise<void> {
  await prisma.app_settings.update({
    where: { id: 1 },
    data: {
      ...(updates.commissionThreshold !== undefined && {
        commission_threshold: updates.commissionThreshold,
      }),
      ...(updates.lowRate !== undefined && { low_rate: updates.lowRate }),
      ...(updates.highRate !== undefined && { high_rate: updates.highRate }),
    },
  })
  revalidatePath("/dashboard")
}
