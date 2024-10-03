import { createDatabase } from 'db0'
import sqlite from 'db0/connectors/better-sqlite3'
import { generate_username } from "./gen"

export type User = {
  user_id: string,
  username: string,
  lichess_token?: string,
}


export const gen_id = () => {
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
    await new_profile(create_profile(user))
}

export async function user_by_id(user_id: string) {
    const { rows } = await db.sql<{ rows: User[]}>`SELECT * from users WHERE id = ${user_id}`

    return rows[0]
}


export async function drop_user_by_id(user_id: string) {
  await db.sql`DELETE FROM users WHERE id = ${user_id}`
  await db.sql`DELETE FROM profiles WHERE user_id = ${user_id}`
}

export const create_profile = (user: User) => {
  return {
    profile_id: gen_id(),
    user_id: user.user_id,
    rating: 1500,
    nb_games: 0
  }
}

export type Profile = {
  profile_id: string,
  user_id: string,
  rating: number,
  nb_games: number
}


await db.sql`CREATE TABLE IF NOT EXISTS profiles ("profile_id" TEXT PRIMARY KEY, "user_id" TEXT, "rating" NUMBER, "nb_games" NUMBER)`

async function new_profile(profile: Profile) {
    await db.sql`INSERT INTO profiles VALUES (${profile.profile_id}, ${profile.user_id}, ${profile.rating}, ${profile.nb_games})`
}

export async function profile_by_username(username: string) {
    const { rows } = await db.sql<{ rows: Profile[]}>`SELECT * from profiles INNER JOIN users ON users.id = profiles.user_id WHERE users.username = ${username}`

    return rows[0]
}