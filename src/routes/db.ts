import { createDatabase } from 'db0'
import sqlite from 'db0/connectors/better-sqlite3'
import { generate_username } from "./gen"

export type User = {
  user_id: string,
  username: string,
  lichess_token?: string,
}


const gen_id = () => {
  return Math.random().toString(16).slice(8)
}

export const create_user = () => {

  return {
    user_id: gen_id(),
    username: generate_username()
  }
}

const db = createDatabase(sqlite({}))

await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "username" TEXT, "lichess_token" TEXT)`

export async function new_user(user: User) {
    await db.sql`INSERT INTO users VALUES (${user.user_id}, ${user.username}, ${user.lichess_token ?? ''})`
}

export async function user_by_id(user_id: string) {
    const { rows } = await db.sql<{ rows: User[]}>`SELECT * from users WHERE id = ${user_id}`

    return rows[0]
}