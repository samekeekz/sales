/**
 * Mock data seed script — inserts realistic test data for chart previews.
 * Run with: node scripts/seed-mock.mjs
 * Remove with: node scripts/seed-mock.mjs --clean
 */

import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "..")

function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {}
}

loadEnv(resolve(rootDir, ".env"))
loadEnv(resolve(rootDir, ".env.local"))

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set.")
  process.exit(1)
}

const { neon } = await import("@neondatabase/serverless")
const sql = neon(DATABASE_URL)

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function isoDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split("T")[0]
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function calcCommission(totalAmount, quantity) {
  const rate = quantity >= 200 ? 0.07 : 0.05
  return { commission: Math.floor((totalAmount * rate) / 10) * 10, rate }
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const MOCK_PREFIX = "mock_"

const DRIVERS = [
  { id: MOCK_PREFIX + "d1", name: "Алибек Жаксыбеков" },
  { id: MOCK_PREFIX + "d2", name: "Серик Нурланов" },
  { id: MOCK_PREFIX + "d3", name: "Бауыржан Сейткали" },
  { id: MOCK_PREFIX + "d4", name: "Дамир Ахметов" },
  { id: MOCK_PREFIX + "d5", name: "Ержан Касымов" },
  { id: MOCK_PREFIX + "d6", name: "Нурлан Бектемиров" },
]

const STORES = [
  { id: MOCK_PREFIX + "s1", name: "Магазин «Арман»",       address: "ул. Абая, 12" },
  { id: MOCK_PREFIX + "s2", name: "Магазин «Достар»",      address: "пр. Назарбаева, 45" },
  { id: MOCK_PREFIX + "s3", name: "Универсам «Жеңіс»",     address: "ул. Гагарина, 88" },
  { id: MOCK_PREFIX + "s4", name: "Продукты «Нур»",        address: "мкр. Самал, 7" },
  { id: MOCK_PREFIX + "s5", name: "Магазин «Береке»",      address: "ул. Байтурсынова, 3" },
  { id: MOCK_PREFIX + "s6", name: "Супермаркет «Алма»",    address: "пр. Республики, 20" },
  { id: MOCK_PREFIX + "s7", name: "Магазин «Сункар»",      address: "ул. Сейфуллина, 67" },
  { id: MOCK_PREFIX + "s8", name: "Продукты «Дархан»",     address: "мкр. Аэропорт, 15" },
]

const PRODUCTS = [
  { id: MOCK_PREFIX + "p1", name: "Молоко 1л",    price: 420 },
  { id: MOCK_PREFIX + "p2", name: "Кефир 1л",     price: 380 },
  { id: MOCK_PREFIX + "p3", name: "Сметана 400г", price: 540 },
]

// ── Clean mode ────────────────────────────────────────────────────────────────

async function clean() {
  console.log("🧹 Removing mock data...")

  const saleIds = await sql`SELECT id FROM sale_records WHERE id LIKE ${"mock_%"}`
  const deliveryIds = [...new Set(
    (await sql`SELECT delivery_id FROM sale_records WHERE id LIKE ${"mock_%"} AND delivery_id IS NOT NULL`)
      .map(r => r.delivery_id)
  )]

  // payments referencing mock debts
  await sql`DELETE FROM payment_records WHERE debt_id IN (SELECT id FROM debt_records WHERE id LIKE ${"mock_%"})`
  await sql`DELETE FROM debt_records WHERE id LIKE ${"mock_%"}`
  await sql`DELETE FROM sale_records WHERE id LIKE ${"mock_%"}`
  await sql`DELETE FROM drivers WHERE id LIKE ${"mock_%"}`
  await sql`DELETE FROM stores WHERE id LIKE ${"mock_%"}`
  await sql`DELETE FROM products WHERE id LIKE ${"mock_%"}`

  console.log("✅ Mock data removed.")
}

// ── Seed mode ─────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding mock data...\n")

  // Drivers
  for (const d of DRIVERS) {
    await sql`
      INSERT INTO drivers (id, name) VALUES (${d.id}, ${d.name})
      ON CONFLICT (id) DO NOTHING
    `
  }
  console.log(`✅ ${DRIVERS.length} drivers inserted`)

  // Stores
  for (const s of STORES) {
    await sql`
      INSERT INTO stores (id, name, address) VALUES (${s.id}, ${s.name}, ${s.address})
      ON CONFLICT (id) DO NOTHING
    `
  }
  console.log(`✅ ${STORES.length} stores inserted`)

  // Products
  for (const p of PRODUCTS) {
    await sql`
      INSERT INTO products (id, name, price, is_deleted) VALUES (${p.id}, ${p.name}, ${p.price}, false)
      ON CONFLICT (id) DO NOTHING
    `
  }
  console.log(`✅ ${PRODUCTS.length} products inserted`)

  // Sales — 30 days of data
  let saleCount = 0
  let debtCount = 0

  // Track cumulative driver quantity per month (to push some over 200 threshold)
  const driverMonthlyQty = {}

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const date = isoDate(daysAgo)

    // 3–6 deliveries per day
    const deliveriesPerDay = randInt(3, 6)
    const driversToday = [...DRIVERS].sort(() => Math.random() - 0.5).slice(0, deliveriesPerDay)

    for (const driver of driversToday) {
      const store = STORES[randInt(0, STORES.length - 1)]
      const deliveryId = MOCK_PREFIX + uid()

      // 1–3 products per delivery
      const numProducts = randInt(1, 3)
      const productsInDelivery = [...PRODUCTS].sort(() => Math.random() - 0.5).slice(0, numProducts)

      let deliveryTotal = 0

      for (const product of productsInDelivery) {
        const qty = randInt(15, 60)
        const unitPrice = product.price
        const totalAmount = qty * unitPrice

        if (!driverMonthlyQty[driver.id]) driverMonthlyQty[driver.id] = 0
        driverMonthlyQty[driver.id] += qty

        const { commission, rate } = calcCommission(totalAmount, driverMonthlyQty[driver.id])

        const saleId = MOCK_PREFIX + uid()
        await sql`
          INSERT INTO sale_records
            (id, date, driver_name, store_id, store_name, product_id, product_name,
             delivery_id, quantity, unit_price, total_amount, commission, commission_rate)
          VALUES
            (${saleId}, ${date}, ${driver.name}, ${store.id}, ${store.name},
             ${product.id}, ${product.name}, ${deliveryId},
             ${qty}, ${unitPrice}, ${totalAmount}, ${commission}, ${rate})
          ON CONFLICT (id) DO NOTHING
        `
        saleCount++
        deliveryTotal += totalAmount
      }

      // Create a debt record for ~60% of deliveries
      if (Math.random() < 0.6) {
        const isPaid = Math.random() < 0.4
        const debtId = MOCK_PREFIX + uid()
        const paidAmount = isPaid ? deliveryTotal : (Math.random() < 0.3 ? Math.floor(deliveryTotal * 0.5 / 100) * 100 : null)

        await sql`
          INSERT INTO debt_records
            (id, store_id, store_name, delivery_date, amount, delivery_id, status, paid_amount)
          VALUES
            (${debtId}, ${store.id}, ${store.name}, ${date}, ${deliveryTotal},
             ${deliveryId},
             ${isPaid ? "paid" : "unpaid"},
             ${paidAmount})
          ON CONFLICT (id) DO NOTHING
        `
        debtCount++
      }
    }
  }

  console.log(`✅ ${saleCount} sale records inserted`)
  console.log(`✅ ${debtCount} debt records inserted`)
  console.log()
  console.log("🎉 Done! Refresh the dashboard to see the charts.")
  console.log("   To remove mock data: node scripts/seed-mock.mjs --clean")
}

// ── Entry point ───────────────────────────────────────────────────────────────

const isClean = process.argv.includes("--clean")
isClean ? await clean() : await seed()
