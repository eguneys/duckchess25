"use server"
import { generate_username } from "./gen"
import { Board_encode, GameId, GameStatus, ProfileId, TimeControl, UserId } from './types'
import { DuckChess } from 'duckops'

import Database from 'better-sqlite3'


const db = new Database('.data/foobar.db')
db.pragma('journal_mode = WAL')



export type Game = {
  id: GameId,
  white: UserId,
  black: UserId,
  clock: TimeControl,
  status: GameStatus,
  cycle_length: number,
  rule50_ply: number,
  board: Buffer,
  sans: string
}

export type User = {
  user_id: UserId,
  username: string,
  lichess_token: string | null,
}

export type Profile = {
  profile_id: ProfileId,
  user_id: UserId,
  rating: number,
  nb_games: number
}




export const gen_id = () => {
  return Math.random().toString(16).slice(8)
}

export const create_game = (white: UserId, black: UserId, clock: TimeControl): Game => {
  let d = DuckChess.default()


  return {
    id: gen_id() + gen_id().slice(0, 4),
    white,
    black,
    clock,
    status: GameStatus.Created,
    cycle_length: d.cycle_length,
    rule50_ply: d.rule50_ply,
    board: Board_encode(d.board),
    sans: ''
  }
}

export const create_user = async (): Promise<User> => {
  let username = generate_username()
  if (user_by_username(username) !== undefined) {
    username = username + gen_id().slice(0, 2)
  }
  return {
    user_id: gen_id(),
    username,
    lichess_token: null
  }
}

export const create_profile = (user: User) => {
  return {
    profile_id: gen_id(),
    user_id: user.user_id,
    rating: 1500,
    nb_games: 0
  }
}

async function create_databases() {



  const create_users = `CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "username" TEXT, "lichess_token" TEXT)`
  const create_profiles = `CREATE TABLE IF NOT EXISTS profiles ("profile_id" TEXT PRIMARY KEY, "user_id" TEXT, "rating" NUMBER, "nb_games" NUMBER)`
  const create_games = `CREATE TABLE IF NOT EXISTS games (
  "id" TEXT PRIMARY KEY, 
  "white" TEXT, 
  "black" TEXT, 
  "status" NUMBER,
  "cycle_length" NUMBER,
  "rule50_ply" NUMBER,
  "board" BLOB,
  "sans" TEXT
  )`


  db.prepare(create_users).run()
  db.prepare(create_profiles).run()
  db.prepare(create_games).run()
}

create_databases()



export async function new_game(game: Game) {
    await db.prepare(`INSERT INTO games VALUES (
      @id, @white, @black, @status,
      @cycle_length, @rule50_ply, $board, @sans)`).run(game)
}

export async function game_by_id(game_id: string) {
    let rows = await db.prepare<GameId, Game>(`SELECT * from games WHERE id = ?`).get(game_id)
    return rows
}




export async function new_user(user: User) {
    await db.prepare(`INSERT INTO users VALUES 
      (@user_id, @username, @lichess_token)`).run(user)
    await new_profile(create_profile(user))
}

export async function user_by_id(user_id: UserId) {
    let rows = db.prepare<UserId, User>(`SELECT * from users WHERE id = ?`).get(user_id)
    return rows
}

export async function user_by_username(username: string) {
    let rows = db.prepare<UserId, User>(`SELECT * from users WHERE username = ?`).get(username)
    return rows
}



export async function drop_user_by_id(user_id: string) {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(user_id)
  db.prepare(`DELETE FROM profiles WHERE user_id = ?`).run(user_id)
}


async function new_profile(profile: Profile) {
    db.prepare(`INSERT INTO profiles VALUES (
      @profile_id, 
      @user_id, 
      @rating, 
      @nb_games)`).run(profile)
}

export async function profile_by_username(username: string) {
    let rows = db.prepare<string, Profile>(`SELECT * from profiles INNER JOIN users ON users.id = profiles.user_id WHERE users.username = ?`)
    .get(username)

    return rows
}