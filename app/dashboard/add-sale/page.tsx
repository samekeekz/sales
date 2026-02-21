"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { SaleForm } from "@/components/sale-form"
import { useEffect } from "react"

export default function AddSalePage() {
  const { isAccountant } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAccountant) {
      router.push("/dashboard")
    }
  }, [isAccountant, router])

  if (!isAccountant) return null

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Добавить продажу</h1>
        <p className="text-sm text-muted-foreground">
          Введите данные о продаже твистеров
        </p>
      </div>
      <SaleForm />
    </div>
  )
}
