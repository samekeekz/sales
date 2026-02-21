"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PackageIcon, DollarSignIcon, PercentIcon, UsersIcon } from "lucide-react"
import { formatNumber, formatCurrency } from "@/lib/calculations"

interface MetricsCardsProps {
  totalQuantity: number
  totalAmount: number
  totalCommission: number
  driversCount: number
}

export function MetricsCards({
  totalQuantity,
  totalAmount,
  totalCommission,
  driversCount,
}: MetricsCardsProps) {
  const cards = [
    {
      title: "Всего продано",
      value: `${formatNumber(totalQuantity)} ед.`,
      icon: PackageIcon,
    },
    {
      title: "Сумма продаж",
      value: formatCurrency(totalAmount),
      icon: DollarSignIcon,
    },
    {
      title: "Комиссии",
      value: formatCurrency(totalCommission),
      icon: PercentIcon,
    },
    {
      title: "Водителей",
      value: formatNumber(driversCount),
      icon: UsersIcon,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
