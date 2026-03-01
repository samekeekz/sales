"use server"

import { prisma } from "@/lib/prisma"
import { authServer } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import type { AppSettings, CommissionTier } from "@/lib/types"

const DEFAULT_SETTINGS: AppSettings = {
  adminPassword: "",
  accountants: [],
  commissionThreshold: 200,
  lowRate: 0.05,
  highRate: 0.07,
  commissionTiers: [],
}

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.app_settings.findUnique({ where: { id: 1 } })
  if (!row) return DEFAULT_SETTINGS

  const threshold = row.commission_threshold.toNumber()
  const lowRate = row.low_rate.toNumber()
  const highRate = row.high_rate.toNumber()

  let commissionTiers: CommissionTier[] = []
  if (row.commission_tiers) {
    try { commissionTiers = JSON.parse(row.commission_tiers) } catch {}
  }

  // First run: no tiers saved yet — build from legacy threshold/rates
  if (commissionTiers.length === 0) {
    commissionTiers = [
      { from: 0, rate: lowRate },
      { from: threshold, rate: highRate },
    ]
  }

  return {
    adminPassword: row.admin_password,
    accountants: [],
    commissionThreshold: threshold,
    lowRate,
    highRate,
    commissionTiers,
  }
}

export async function changeAdminPassword(params: {
  currentPassword: string
  newPassword: string
}): Promise<{ error?: string }> {
  const { error } = await authServer.changePassword({
    currentPassword: params.currentPassword,
    newPassword: params.newPassword,
    revokeOtherSessions: false,
  })
  if (error) return { error: error.message }
  return {}
}

export async function updateSettings(updates: Partial<Omit<AppSettings, "accountants">>): Promise<void> {
  const tiersJson = updates.commissionTiers !== undefined
    ? JSON.stringify(updates.commissionTiers)
    : undefined

  // Also sync legacy columns from the first two tiers for backward compat
  let legacyData = {}
  if (updates.commissionTiers && updates.commissionTiers.length >= 2) {
    const sorted = [...updates.commissionTiers].sort((a, b) => a.from - b.from)
    legacyData = {
      low_rate: sorted[0].rate,
      high_rate: sorted[sorted.length - 1].rate,
      commission_threshold: sorted[1].from,
    }
  }

  await prisma.app_settings.update({
    where: { id: 1 },
    data: {
      ...(updates.commissionThreshold !== undefined && { commission_threshold: updates.commissionThreshold }),
      ...(updates.lowRate !== undefined && { low_rate: updates.lowRate }),
      ...(updates.highRate !== undefined && { high_rate: updates.highRate }),
      ...(tiersJson !== undefined && { commission_tiers: tiersJson }),
      ...legacyData,
    },
  })
  revalidatePath("/dashboard")
}
