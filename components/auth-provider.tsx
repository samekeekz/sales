"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { authClient } from "@/lib/auth/client"
import { getUserProfile } from "@/app/actions/accountants"

interface AuthContextValue {
  role: "admin" | "accountant" | null
  accountantName: string | null
  isLoaded: boolean
  logout: () => Promise<void>
  isAccountant: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const [role, setRole] = useState<"admin" | "accountant" | null>(null)
  const [accountantName, setAccountantName] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const userId = session.data?.user?.id
  const isPending = session.isPending

  useEffect(() => {
    if (isPending) return
    if (!userId) {
      setRole(null)
      setAccountantName(null)
      setIsLoaded(true)
      return
    }
    getUserProfile(userId).then((profile) => {
      if (profile) {
        setRole(profile.role as "admin" | "accountant")
        setAccountantName(profile.name)
      } else {
        setRole(null)
        setAccountantName(null)
      }
      setIsLoaded(true)
    })
  }, [isPending, userId])

  async function logout() {
    await authClient.signOut()
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider
      value={{
        role,
        accountantName,
        isLoaded,
        logout,
        isAccountant: role === "accountant" || role === "admin",
        isAdmin: role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
