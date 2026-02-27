"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { getSettings, updateSettings } from "@/app/actions/settings"

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()

  const [threshold, setThreshold] = useState("")
  const [lowRate, setLowRate] = useState("")
  const [highRate, setHighRate] = useState("")

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard")
      return
    }
    getSettings().then((settings) => {
      setThreshold(settings.commissionThreshold.toString())
      setLowRate((settings.lowRate * 100).toString())
      setHighRate((settings.highRate * 100).toString())
    })
  }, [isAdmin, router])

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault()
    const thresh = parseInt(threshold)
    const low = parseFloat(lowRate) / 100
    const high = parseFloat(highRate) / 100

    if (isNaN(thresh) || thresh <= 0) {
      toast.error("Введите корректный порог")
      return
    }
    if (isNaN(low) || low <= 0 || low >= 1) {
      toast.error("Введите корректную ставку (от 1 до 99)")
      return
    }
    if (isNaN(high) || high <= 0 || high >= 1) {
      toast.error("Введите корректную ставку (от 1 до 99)")
      return
    }
    if (high <= low) {
      toast.error("Повышенная ставка должна быть выше базовой")
      return
    }

    await updateSettings({ commissionThreshold: thresh, lowRate: low, highRate: high })
    toast.success("Настройки сохранены")
  }

  if (!isAdmin) return null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Настройки</h1>
        <p className="text-sm text-muted-foreground">
          Управление параметрами системы (только для администратора)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Параметры комиссии</CardTitle>
          <CardDescription>
            Порог и ставки комиссии. Цены за товары задаются в разделе «Товары».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveGeneral} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="threshold">Порог для повышенной ставки (ед.)</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                При достижении этого количества единиц за неделю, ставка комиссии повышается
              </p>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="lowRate">Базовая ставка (%)</Label>
                <Input
                  id="lowRate"
                  type="number"
                  min="1"
                  max="99"
                  step="0.1"
                  value={lowRate}
                  onChange={(e) => setLowRate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="highRate">Повышенная ставка (%)</Label>
                <Input
                  id="highRate"
                  type="number"
                  min="1"
                  max="99"
                  step="0.1"
                  value={highRate}
                  onChange={(e) => setHighRate(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full">
              Сохранить настройки
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
