"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboardIcon,
  PlusCircleIcon,
  ListIcon,
  FileTextIcon,
  UsersIcon,
  SettingsIcon,
  LogOutIcon,
  TruckIcon,
  ShieldIcon,
  StoreIcon,
  CreditCardIcon,
  PackageIcon,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

type MinRole = "accountant" | "admin"

const navItems: {
  title: string
  href: string
  icon: React.ComponentType
  minRole: MinRole
}[] = [
  {
    title: "Панель управления",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    minRole: "accountant",
  },
  {
    title: "Записать поставку",
    href: "/dashboard/add-sale",
    icon: PlusCircleIcon,
    minRole: "accountant",
  },
  {
    title: "История поставок",
    href: "/dashboard/sales",
    icon: ListIcon,
    minRole: "accountant",
  },
  {
    title: "Отчёты",
    href: "/dashboard/reports",
    icon: FileTextIcon,
    minRole: "accountant",
  },
  {
    title: "Водители",
    href: "/dashboard/drivers",
    icon: UsersIcon,
    minRole: "accountant",
  },
  {
    title: "Магазины",
    href: "/dashboard/stores",
    icon: StoreIcon,
    minRole: "accountant",
  },
  {
    title: "Долги магазинов",
    href: "/dashboard/debts",
    icon: CreditCardIcon,
    minRole: "accountant",
  },
  {
    title: "Товары",
    href: "/dashboard/products",
    icon: PackageIcon,
    minRole: "admin",
  },
  {
    title: "Бухгалтеры",
    href: "/dashboard/accountants",
    icon: ShieldIcon,
    minRole: "admin",
  },
  {
    title: "Настройки",
    href: "/dashboard/settings",
    icon: SettingsIcon,
    minRole: "admin",
  },
]

const ROLE_LEVEL: Record<MinRole, number> = {
  accountant: 1,
  admin: 2,
}

function hasAccess(userRole: string | null, minRole: MinRole): boolean {
  if (!userRole) return false
  return (ROLE_LEVEL[userRole as MinRole] ?? 0) >= ROLE_LEVEL[minRole]
}

function getRoleLabel(role: string | null, accountantName: string | null): string {
  if (role === "admin") return "Администратор"
  if (role === "accountant") return accountantName ? `Бухгалтер: ${accountantName}` : "Бухгалтер"
  return ""
}

export function AppSidebar() {
  const pathname = usePathname()
  const { isAdmin, role, accountantName, logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()

  function closeMobile() {
    if (isMobile) setOpenMobile(false)
  }

  const filteredItems = navItems.filter((item) => hasAccess(role, item.minRole))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" onClick={closeMobile}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <TruckIcon className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">{"Учёт продаж"}</span>
                  <span className="text-xs text-muted-foreground">
                    {getRoleLabel(role, accountantName)}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{"Навигация"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href} onClick={closeMobile}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
              <Badge variant={isAdmin ? "default" : role === "accountant" ? "outline" : "secondary"}>
                {getRoleLabel(role, accountantName)}
              </Badge>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Выйти"
              onClick={async (e) => { e.preventDefault(); await logout() }}
            >
              <LogOutIcon />
              <span>{"Выйти"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
