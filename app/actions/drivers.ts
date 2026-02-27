"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { Driver } from "@/lib/types"

function toDriver(d: { id: string; name: string; created_at: Date }): Driver {
  return { id: d.id, name: d.name, createdAt: d.created_at.toISOString() }
}

export async function getDrivers(): Promise<Driver[]> {
  const rows = await prisma.drivers.findMany({ orderBy: { created_at: "asc" } })
  return rows.map(toDriver)
}

export async function addDriver(driver: Driver): Promise<void> {
  await prisma.drivers.create({
    data: { id: driver.id, name: driver.name, created_at: new Date(driver.createdAt) },
  })
  revalidatePath("/dashboard")
}

export async function updateDriver(id: string, updated: Partial<Driver>): Promise<void> {
  await prisma.drivers.update({ where: { id }, data: { name: updated.name } })
  revalidatePath("/dashboard")
}

export async function deleteDriver(id: string): Promise<void> {
  await prisma.drivers.delete({ where: { id } })
  revalidatePath("/dashboard")
}
