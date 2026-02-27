"use server"

import { prisma } from "@/lib/prisma"
import { authServer } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"

export interface AccountantProfile {
  id: string       // user_profiles.id
  authUserId: string
  name: string
  email: string
  createdAt: string
}

export async function getAccountants(): Promise<AccountantProfile[]> {
  const rows = await prisma.user_profiles.findMany({
    where: { role: "accountant" },
    orderBy: { created_at: "asc" },
  })
  return rows.map((r) => ({
    id: r.id,
    authUserId: r.auth_user_id,
    name: r.name,
    email: r.email,
    createdAt: r.created_at.toISOString(),
  }))
}

export async function createAccountant(params: {
  name: string
  email: string
  password: string
}): Promise<{ error?: string }> {
  const { data, error } = await authServer.admin.createUser({
    email: params.email,
    password: params.password,
    name: params.name,
    role: "user",
  })

  if (error) return { error: error.message }

  await prisma.user_profiles.create({
    data: {
      auth_user_id: data.user.id,
      role: "accountant",
      name: params.name,
      email: params.email,
    },
  })

  revalidatePath("/dashboard")
  return {}
}

export async function updateAccountant(
  authUserId: string,
  params: { name?: string; email?: string; password?: string }
): Promise<{ error?: string }> {
  if (params.name || params.email) {
    const { error } = await authServer.admin.updateUser({
      userId: authUserId,
      data: {
        ...(params.name && { name: params.name }),
        ...(params.email && { email: params.email }),
      },
    })
    if (error) return { error: error.message }
  }

  if (params.password) {
    const { error } = await authServer.admin.setUserPassword({
      userId: authUserId,
      newPassword: params.password,
    })
    if (error) return { error: error.message }
  }

  await prisma.user_profiles.update({
    where: { auth_user_id: authUserId },
    data: {
      ...(params.name && { name: params.name }),
      ...(params.email && { email: params.email }),
    },
  })

  revalidatePath("/dashboard")
  return {}
}

export async function deleteAccountant(authUserId: string): Promise<{ error?: string }> {
  const { error } = await authServer.admin.removeUser({ userId: authUserId })
  if (error) return { error: error.message }

  await prisma.user_profiles.delete({ where: { auth_user_id: authUserId } })
  revalidatePath("/dashboard")
  return {}
}

export async function getUserProfile(authUserId: string) {
  return prisma.user_profiles.findUnique({ where: { auth_user_id: authUserId } })
}
