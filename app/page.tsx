"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TruckIcon, EyeIcon, LockIcon } from "lucide-react"

function LoginForm() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const router = useRouter()
  const { login, loginAsViewer } = useAuth()

  function handleAccountantLogin(e: React.FormEvent) {
    e.preventDefault()
    if (login(password)) {
      router.push("/dashboard")
    } else {
      setError("Неверный пароль")
      setPassword("")
    }
  }

  function handleViewerLogin() {
    loginAsViewer()
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <TruckIcon className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
            Учёт продаж водителей
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Система отслеживания продаж и расчёта комиссионных
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Вход в систему</CardTitle>
            <CardDescription>Выберите режим доступа</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!showPasswordForm ? (
              <>
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => setShowPasswordForm(true)}
                >
                  <LockIcon className="h-4 w-4" />
                  Войти с паролем
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleViewerLogin}
                >
                  <EyeIcon className="h-4 w-4" />
                  Просмотр отчётов
                </Button>
              </>
            ) : (
              <form onSubmit={handleAccountantLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Пароль (админ / бухгалтер)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError("")
                    }}
                    placeholder="Введите пароль"
                    autoFocus
                  />
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="submit" size="lg" className="w-full">
                    Войти
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setError("")
                      setPassword("")
                    }}
                  >
                    Назад
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Пароль администратора по умолчанию: admin
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  )
}
