"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { Product } from "@/lib/types"

function toProduct(p: {
  id: string
  name: string
  price: { toNumber(): number }
  is_deleted: boolean
  created_at: Date
}): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price.toNumber(),
    isDeleted: p.is_deleted,
    createdAt: p.created_at.toISOString(),
  }
}

export async function getProducts(): Promise<Product[]> {
  const rows = await prisma.products.findMany({ orderBy: { created_at: "asc" } })
  return rows.map(toProduct)
}

export async function getActiveProducts(): Promise<Product[]> {
  const rows = await prisma.products.findMany({
    where: { is_deleted: false },
    orderBy: { name: "asc" },
  })
  return rows.map(toProduct)
}

export async function addProduct(product: Product): Promise<void> {
  await prisma.products.create({
    data: {
      id: product.id,
      name: product.name,
      price: product.price,
      is_deleted: product.isDeleted,
      created_at: new Date(product.createdAt),
    },
  })
  revalidatePath("/dashboard")
}

export async function updateProduct(id: string, updated: Partial<Product>): Promise<void> {
  await prisma.products.update({
    where: { id },
    data: {
      ...(updated.name !== undefined && { name: updated.name }),
      ...(updated.price !== undefined && { price: updated.price }),
      ...(updated.isDeleted !== undefined && { is_deleted: updated.isDeleted }),
    },
  })
  revalidatePath("/dashboard")
}

export async function softDeleteProduct(id: string): Promise<void> {
  await prisma.products.update({ where: { id }, data: { is_deleted: true } })
  revalidatePath("/dashboard")
}

export async function restoreProduct(id: string): Promise<void> {
  await prisma.products.update({ where: { id }, data: { is_deleted: false } })
  revalidatePath("/dashboard")
}
