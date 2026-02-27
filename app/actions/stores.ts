"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { Store } from "@/lib/types"

function toStore(s: {
  id: string
  name: string
  address: string | null
  contact_phone: string | null
  created_at: Date
}): Store {
  return {
    id: s.id,
    name: s.name,
    address: s.address ?? undefined,
    contactPhone: s.contact_phone ?? undefined,
    createdAt: s.created_at.toISOString(),
  }
}

export async function getStores(): Promise<Store[]> {
  const rows = await prisma.stores.findMany({ orderBy: { name: "asc" } })
  return rows.map(toStore)
}

export async function addStore(store: Store): Promise<void> {
  await prisma.stores.create({
    data: {
      id: store.id,
      name: store.name,
      address: store.address ?? null,
      contact_phone: store.contactPhone ?? null,
      created_at: new Date(store.createdAt),
    },
  })
  revalidatePath("/dashboard")
}

export async function updateStore(id: string, updated: Partial<Store>): Promise<void> {
  await prisma.stores.update({
    where: { id },
    data: {
      ...(updated.name !== undefined && { name: updated.name }),
      ...(updated.address !== undefined && { address: updated.address }),
      ...(updated.contactPhone !== undefined && { contact_phone: updated.contactPhone }),
    },
  })
  revalidatePath("/dashboard")
}

export async function deleteStore(id: string): Promise<void> {
  await prisma.stores.delete({ where: { id } })
  revalidatePath("/dashboard")
}
