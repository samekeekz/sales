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
import { getSettings, updateSettings, changeAdminPassword } from "@/app/actions/settings"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useCallback } from "react"

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [threshold, setThreshold] = useState("")
  const [lowRate, setLowRate] = useState("")
  const [highRate, setHighRate] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const loadSettings = useCallback(async () => {
    setStatus("loading")
    try {
      const settings = await getSettings()
      setThreshold(settings.commissionThreshold.toString())
      setLowRate((settings.lowRate * 100).toString())
      setHighRate((settings.highRate * 100).toString())
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard")
      return
    }
    loadSettings()
  }, [isAdmin, router, loadSettings])

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!newPassword) { toast.error("Введите новый пароль"); return }
    if (newPassword !== confirmPassword) { toast.error("Пароли не совпадают"); return }
    if (newPassword.length < 8) { toast.error("Пароль должен быть не менее 8 символов"); return }

    const result = await changeAdminPassword({ currentPassword, newPassword })
    if (result.error) { toast.error(result.error); return }

    toast.success("Пароль изменён")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
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
          {status === "loading" ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-px w-full" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="h-9 w-full" />
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Не удалось загрузить настройки</p>
              <Button variant="outline" size="sm" onClick={loadSettings}>Повторить</Button>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Смена пароля</CardTitle>
          <CardDescription>Изменить пароль учётной записи администратора</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPwd">Текущий пароль</Label>
              <div className="relative">
                <Input
                  id="currentPwd"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Введите текущий пароль"
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground"
                  onClick={() => setShowCurrent((v) => !v)}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPwd">Новый пароль</Label>
              <div className="relative">
                <Input
                  id="newPwd"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground"
                  onClick={() => setShowNew((v) => !v)}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPwd">Подтвердите новый пароль</Label>
              <Input
                id="confirmPwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
              />
            </div>
            <Button type="submit" className="w-full">
              Сменить пароль
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
