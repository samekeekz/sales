"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { UserRole } from "@/lib/types"
import { getSettings } from "@/lib/storage"

interface AuthContextValue {
  role: UserRole | null
  accountantName: string | null
  isLoaded: boolean
  login: (password: string) => boolean
  loginAsViewer: () => void
  logout: () => void
  isAccountant: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getStoredRole(): UserRole | null {
  if (typeof window === "undefined") return null
  const stored = sessionStorage.getItem("user_role")
  if (stored === "admin" || stored === "accountant" || stored === "viewer") return stored
  return null
}

function getStoredName(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem("user_name")
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null)
  const [accountantName, setAccountantName] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setRole(getStoredRole())
    setAccountantName(getStoredName())
    setIsLoaded(true)
  }, [])

  const login = useCallback((password: string): boolean => {
    const settings = getSettings()

    // Check admin password first
    if (password === settings.adminPassword) {
      setRole("admin")
      setAccountantName(null)
      sessionStorage.setItem("user_role", "admin")
      sessionStorage.removeItem("user_name")
      return true
    }

    // Check accountant passwords
    const matchedAccountant = settings.accountants.find((a) => a.password === password)
    if (matchedAccountant) {
      setRole("accountant")
      setAccountantName(matchedAccountant.name)
      sessionStorage.setItem("user_role", "accountant")
      sessionStorage.setItem("user_name", matchedAccountant.name)
      return true
    }

    return false
  }, [])

  const loginAsViewer = useCallback(() => {
    setRole("viewer")
    setAccountantName(null)
    sessionStorage.setItem("user_role", "viewer")
    sessionStorage.removeItem("user_name")
  }, [])

  const logout = useCallback(() => {
    setRole(null)
    setAccountantName(null)
    sessionStorage.removeItem("user_role")
    sessionStorage.removeItem("user_name")
  }, [])

  return (
    <AuthContext.Provider
      value={{
        role,
        accountantName,
        isLoaded,
        login,
        loginAsViewer,
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
