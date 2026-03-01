"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { getSettings, updateSettings, changeAdminPassword } from "@/app/actions/settings"
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { CommissionTier } from "@/lib/types"

interface TierRow {
  from: string
  rate: string
}

function tiersToRows(tiers: CommissionTier[]): TierRow[] {
  const sorted = [...tiers].sort((a, b) => a.from - b.from)
  return sorted.map((t) => ({ from: t.from.toString(), rate: (t.rate * 100).toString() }))
}

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [tiers, setTiers] = useState<TierRow[]>([{ from: "0", rate: "5" }])

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const loadSettings = useCallback(async () => {
    setStatus("loading")
    try {
      const settings = await getSettings()
      setTiers(tiersToRows(settings.commissionTiers))
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

  function addTier() {
    setTiers((prev) => [...prev, { from: "", rate: "" }])
  }

  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateTier(idx: number, field: keyof TierRow, value: string) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  async function handleSaveTiers(e: React.FormEvent) {
    e.preventDefault()

    const parsed: CommissionTier[] = []
    for (let i = 0; i < tiers.length; i++) {
      const from = i === 0 ? 0 : parseInt(tiers[i].from)
      const rate = parseFloat(tiers[i].rate) / 100

      if (i > 0 && (isNaN(from) || from <= 0)) {
        toast.error(`Ставка ${i + 1}: введите корректный минимум (целое число > 0)`)
        return
      }
      if (isNaN(rate) || rate <= 0 || rate >= 1) {
        toast.error(`Ставка ${i + 1}: введите корректный процент (от 0.1 до 99.9%)`)
        return
      }
      parsed.push({ from: i === 0 ? 0 : from, rate })
    }

    // Validate strictly increasing `from` and `rate`
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].from <= parsed[i - 1].from) {
        toast.error(`Ставка ${i + 1}: минимум должен быть больше предыдущего (${parsed[i - 1].from} шт.)`)
        return
      }
      if (parsed[i].rate <= parsed[i - 1].rate) {
        toast.error(`Ставка ${i + 1}: процент должен быть выше предыдущего (${parsed[i - 1].rate * 100}%)`)
        return
      }
    }

    if (parsed.length < 1) {
      toast.error("Добавьте хотя бы одну ставку")
      return
    }

    await updateSettings({ commissionTiers: parsed })
    toast.success("Настройки комиссии сохранены")
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
          <CardTitle className="text-base">Ступенчатая комиссия</CardTitle>
          <CardDescription>
            Ставка зависит от количества товара: каждая ставка задаёт минимум единиц и процент комиссии.
            Применяется наивысшая подходящая ставка.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-24" />
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Не удалось загрузить настройки</p>
              <Button variant="outline" size="sm" onClick={loadSettings}>Повторить</Button>
            </div>
          ) : (
            <form onSubmit={handleSaveTiers} className="flex flex-col gap-4">
              <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>От (шт.)</span>
                <span>Ставка (%)</span>
                <span />
              </div>

              {tiers.map((tier, idx) => {
                const prevRate = idx > 0 ? parseFloat(tiers[idx - 1].rate) : null
                const thisRate = parseFloat(tier.rate)
                const rateError = prevRate !== null && !isNaN(thisRate) && thisRate <= prevRate
                return (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                  {idx === 0 ? (
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      0 (базовый)
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min="1"
                      placeholder="напр. 70"
                      value={tier.from}
                      onChange={(e) => updateTier(idx, "from", e.target.value)}
                    />
                  )}
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      placeholder="напр. 5"
                      value={tier.rate}
                      onChange={(e) => updateTier(idx, "rate", e.target.value)}
                      className={`pr-7 ${rateError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                  {idx === 0 ? (
                    <div className="w-8" />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeTier(idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )})}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start gap-1.5"
                onClick={addTier}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Добавить ставку
              </Button>

              {tiers.length > 0 && (
                <div className="flex flex-wrap items-stretch gap-2">
                  {tiers.map((t, i) => {
                    const from = i === 0 ? 0 : parseInt(t.from) || 0
                    const next = tiers[i + 1]
                    const to = next ? `${(parseInt(next.from) || 0) - 1}` : null
                    const rate = parseFloat(t.rate) || 0
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/40 px-4 py-2.5 min-w-[90px]">
                          <span className="text-xl font-bold leading-none">{rate}%</span>
                          <span className="mt-1 text-xs text-muted-foreground">
                            {to ? `${from} – ${to} шт.` : `от ${from} шт.`}
                          </span>
                        </div>
                        {next && (
                          <span className="text-muted-foreground text-sm">→</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <Button type="submit" className="w-full">
                Сохранить настройки комиссии
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
