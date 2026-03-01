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
import {
  getAccountants,
  createAccountant,
  updateAccountant,
  deleteAccountant,
  type AccountantProfile,
} from "@/app/actions/accountants"
import { PlusIcon, TrashIcon, PencilIcon, EyeIcon, EyeOffIcon, CopyIcon, CheckIcon } from "lucide-react"

export default function AccountantsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()

  const [accountants, setAccountants] = useState<AccountantProfile[]>([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadData = useCallback(async () => {
    const data = await getAccountants()
    setAccountants(data)
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard")
      return
    }
    loadData()
  }, [isAdmin, router, loadData])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedName) { toast.error("Введите имя бухгалтера"); return }
    if (!trimmedEmail) { toast.error("Введите email"); return }
    if (!trimmedPassword) { toast.error("Введите пароль"); return }

    if (accountants.some((a) => a.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("Бухгалтер с таким именем уже существует"); return
    }
    if (accountants.some((a) => a.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      toast.error("Бухгалтер с таким email уже существует"); return
    }

    const result = await createAccountant({ name: trimmedName, email: trimmedEmail, password: trimmedPassword })
    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(`Бухгалтер "${trimmedName}" добавлен`)
    setName("")
    setEmail("")
    setPassword("")
    await loadData()
  }

  async function handleDelete(acc: AccountantProfile) {
    const result = await deleteAccountant(acc.authUserId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Бухгалтер "${acc.name}" удалён`)
    await loadData()
  }

  function openEdit(acc: AccountantProfile) {
    setEditingId(acc.authUserId)
    setEditName(acc.name)
    setEditEmail(acc.email)
    setEditPassword("")
    setDialogOpen(true)
  }

  async function handleSaveEdit() {
    if (!editingId) return
    const trimmedName = editName.trim()
    const trimmedEmail = editEmail.trim()

    if (!trimmedName) { toast.error("Введите имя бухгалтера"); return }
    if (!trimmedEmail) { toast.error("Введите email"); return }

    const params: { name?: string; email?: string; password?: string } = {}
    if (trimmedName) params.name = trimmedName
    if (trimmedEmail) params.email = trimmedEmail
    if (editPassword.trim()) params.password = editPassword.trim()

    const result = await updateAccountant(editingId, params)
    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Данные бухгалтера обновлены")
    setDialogOpen(false)
    setEditingId(null)
    await loadData()
  }

  if (!isAdmin) return null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Бухгалтеры</h1>
        <p className="text-sm text-muted-foreground">
          Управление учётными записями бухгалтеров
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Добавить бухгалтера</CardTitle>
          <CardDescription>Создайте учётную запись с email и паролем</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="accName">Имя</Label>
                <Input
                  id="accName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Айгуль"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="accEmail">Email</Label>
                <Input
                  id="accEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aigul@company.kz"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="accPassword">Пароль</Label>
                <div className="relative">
                  <Input
                    id="accPassword"
                    type={showCreatePassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Временный пароль"
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-9 text-muted-foreground"
                    onClick={() => setShowCreatePassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showCreatePassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button type="submit" className="gap-1 w-fit">
              <PlusIcon className="h-4 w-4" />
              Добавить
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Список бухгалтеров ({accountants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountants.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Бухгалтеры ещё не добавлены. Добавьте первого бухгалтера выше.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Дата создания</TableHead>
                  <TableHead className="w-[100px] text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountants.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.email}</TableCell>
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
            <DialogTitle>Редактировать бухгалтера</DialogTitle>
            <DialogDescription>Измените имя, email или пароль бухгалтера</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="editName">Имя</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="editPwd">Новый пароль (оставьте пустым, чтобы не менять)</Label>
              <div className="relative">
                <Input
                  id="editPwd"
                  type={showEditPassword ? "text" : "password"}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Новый пароль (необязательно)"
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground"
                  onClick={() => setShowEditPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showEditPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveEdit}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show created password once */}
      <Dialog open={!!createdPassword} onOpenChange={(open) => { if (!open) { setCreatedPassword(null); setCopied(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Бухгалтер добавлен</DialogTitle>
            <DialogDescription>
              Сохраните пароль — он больше не будет показан
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <span className="flex-1 font-mono text-sm select-all">{createdPassword}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(createdPassword ?? "")
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <CopyIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setCreatedPassword(null); setCopied(false) }}>
              Я сохранил пароль
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
