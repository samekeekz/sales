"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { getSettings, addAccountant, deleteAccountant, updateAccountant, generateId } from "@/lib/storage"
import type { AccountantUser } from "@/lib/types"
import { PlusIcon, TrashIcon, PencilIcon, EyeIcon, EyeOffIcon } from "lucide-react"

export default function AccountantsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()

  const [accountants, setAccountants] = useState<AccountantUser[]>([])
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")

  // Edit dialog
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  // Password visibility
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())

  const refreshAccountants = useCallback(() => {
    const settings = getSettings()
    setAccountants(settings.accountants)
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard")
      return
    }
    refreshAccountants()
  }, [isAdmin, router, refreshAccountants])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedPassword = password.trim()

    if (!trimmedName) {
      toast.error("Введите имя бухгалтера")
      return
    }
    if (!trimmedPassword) {
      toast.error("Введите пароль")
      return
    }

    // Check for duplicate name
    if (accountants.some((a) => a.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("Бухгалтер с таким именем уже существует")
      return
    }

    // Check password doesn't conflict with admin password
    const settings = getSettings()
    if (trimmedPassword === settings.adminPassword) {
      toast.error("Пароль не может совпадать с паролем администратора")
      return
    }

    // Check for duplicate password among accountants
    if (accountants.some((a) => a.password === trimmedPassword)) {
      toast.error("Этот пароль уже используется другим бухгалтером. Каждый бухгалтер должен иметь уникальный пароль.")
      return
    }

    const newAccountant: AccountantUser = {
      id: generateId(),
      name: trimmedName,
      password: trimmedPassword,
      createdAt: new Date().toISOString(),
    }

    addAccountant(newAccountant)
    refreshAccountants()
    setName("")
    setPassword("")
    toast.success(`Бухгалтер "${trimmedName}" добавлен`)
  }

  function handleDelete(acc: AccountantUser) {
    deleteAccountant(acc.id)
    refreshAccountants()
    toast.success(`Бухгалтер "${acc.name}" удалён`)
  }

  function openEdit(acc: AccountantUser) {
    setEditingId(acc.id)
    setEditName(acc.name)
    setEditPassword(acc.password)
    setDialogOpen(true)
  }

  function handleSaveEdit() {
    if (!editingId) return
    const trimmedName = editName.trim()
    const trimmedPassword = editPassword.trim()

    if (!trimmedName) {
      toast.error("Введите имя бухгалтера")
      return
    }
    if (!trimmedPassword) {
      toast.error("Введите пароль")
      return
    }

    // Check for duplicate name (excluding current)
    if (accountants.some((a) => a.id !== editingId && a.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("Бухгалтер с таким именем уже существует")
      return
    }

    // Check password doesn't conflict with admin
    const settings = getSettings()
    if (trimmedPassword === settings.adminPassword) {
      toast.error("Пароль не может совпадать с паролем администратора")
      return
    }

    // Check for duplicate password (excluding current)
    if (accountants.some((a) => a.id !== editingId && a.password === trimmedPassword)) {
      toast.error("Этот пароль уже используется другим бухгалтером")
      return
    }

    updateAccountant(editingId, { name: trimmedName, password: trimmedPassword })
    refreshAccountants()
    setDialogOpen(false)
    setEditingId(null)
    toast.success("Данные бухгалтера обновлены")
  }

  function togglePasswordVisibility(id: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (!isAdmin) return null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{"Бухгалтеры"}</h1>
        <p className="text-sm text-muted-foreground">
          {"Управление учётными записями бухгалтеров. Каждый бухгалтер входит по своему уникальному паролю."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{"Добавить бухгалтера"}</CardTitle>
          <CardDescription>{"Создайте учётную запись с уникальным именем и паролем"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="accName">{"Имя"}</Label>
              <Input
                id="accName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Айгуль"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="accPassword">{"Пароль"}</Label>
              <Input
                id="accPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Уникальный пароль"
              />
            </div>
            <Button type="submit" className="gap-1">
              <PlusIcon className="h-4 w-4" />
              {"Добавить"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {"Список бухгалтеров"} ({accountants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountants.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {"Бухгалтеры ещё не добавлены. Добавьте первого бухгалтера выше."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{"Имя"}</TableHead>
                  <TableHead>{"Пароль"}</TableHead>
                  <TableHead>{"Дата создания"}</TableHead>
                  <TableHead className="w-[100px] text-right">{"Действия"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountants.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {visiblePasswords.has(acc.id) ? acc.password : "••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => togglePasswordVisibility(acc.id)}
                          aria-label={visiblePasswords.has(acc.id) ? "Скрыть пароль" : "Показать пароль"}
                        >
                          {visiblePasswords.has(acc.id) ? (
                            <EyeOffIcon className="h-3.5 w-3.5" />
                          ) : (
                            <EyeIcon className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(acc.createdAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(acc)}
                          aria-label="Редактировать"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(acc)}
                          aria-label="Удалить"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Редактировать бухгалтера"}</DialogTitle>
            <DialogDescription>{"Измените имя или пароль бухгалтера"}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="editName">{"Имя"}</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="editPwd">{"Пароль"}</Label>
              <Input
                id="editPwd"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {"Отмена"}
            </Button>
            <Button onClick={handleSaveEdit}>
              {"Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
