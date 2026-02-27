/**
 * Seed script: creates the admin account in Neon Auth + user_profiles table.
 *
 * Prerequisites:
 *   1. NEON_AUTH_BASE_URL and DATABASE_URL must be set in .env
 *
 * Run with:
 *   node scripts/seed-admin.mjs
 */

import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "..")

// Load .env and .env.local manually
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
  } catch {
    // File may not exist
  }
}

loadEnv(resolve(rootDir, ".env"))

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set.")
  process.exit(1)
}

if (!NEON_AUTH_BASE_URL) {
  console.error("❌ NEON_AUTH_BASE_URL is not set.")
  process.exit(1)
}

const ADMIN_EMAIL = "admin@sales.local"
const ADMIN_PASSWORD = "Admin1234!"
const ADMIN_NAME = "Администратор"

async function createUserInNeonAuth() {
  const url = `${NEON_AUTH_BASE_URL}/sign-up/email`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": NEON_AUTH_BASE_URL,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
    }),
  })

  const text = await res.text()

  if (!res.ok) {
    // If user already exists (409), return null to skip creation
    if (res.status === 409 || text.includes("already exists") || text.includes("CONFLICT")) {
      return null
    }
    throw new Error(`Auth server error ${res.status}: ${text}`)
  }

  const data = JSON.parse(text)
  return data.user
}

async function getUserIdFromAuthDb() {
  const { neon } = await import("@neondatabase/serverless")
  const sql = neon(DATABASE_URL)

  // Neon Auth stores users in the auth schema
  try {
    const rows = await sql`
      SELECT id FROM auth.users WHERE email = ${ADMIN_EMAIL} LIMIT 1
    `
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}

async function createUserProfile(authUserId) {
  const { neon } = await import("@neondatabase/serverless")
  const sql = neon(DATABASE_URL)

  const existing = await sql`
    SELECT id FROM user_profiles WHERE auth_user_id = ${authUserId}
  `
  if (existing.length > 0) {
    console.log("ℹ️  user_profiles record already exists.")
    return
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9)

  await sql`
    INSERT INTO user_profiles (id, auth_user_id, role, name, email)
    VALUES (${id}, ${authUserId}, 'admin', ${ADMIN_NAME}, ${ADMIN_EMAIL})
  `
  console.log("✅ user_profiles record created.")
}

async function main() {
  console.log("🌱 Seeding admin account...")
  console.log(`   Email:    ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}`)
  console.log()

  let userId

  const user = await createUserInNeonAuth()

  if (user) {
    userId = user.id
    console.log(`✅ User created in Neon Auth (id: ${userId})`)
  } else {
    console.log("ℹ️  User already exists in Neon Auth, looking up ID...")
    userId = await getUserIdFromAuthDb()
    if (!userId) {
      console.log()
      console.log("⚠️  Could not look up user ID automatically.")
      console.log("   Find the user ID in Neon Console → Auth → Users,")
      console.log("   then manually insert into user_profiles:")
      console.log()
      console.log(`   INSERT INTO user_profiles (id, auth_user_id, role, name, email)`)
      console.log(`   VALUES ('admin1', '<user-id-here>', 'admin', '${ADMIN_NAME}', '${ADMIN_EMAIL}');`)
      return
    }
    console.log(`   Found user ID: ${userId}`)
  }

  await createUserProfile(userId)

  console.log()
  console.log("🎉 Done!")
  console.log(`   Login at: http://localhost:3000/login`)
  console.log(`   Email:    ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}`)
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message)
  process.exit(1)
})
