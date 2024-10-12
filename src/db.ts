"use server"
import { generate_username } from "./gen"
import { Board_encode, Castles_encode, GameId, GameStatus, ProfileId, SessionId, TimeControl, UserId } from './types'
import { Board, Color, DuckChess } from 'duckops'

import Database from 'better-sqlite3'


const db = new Database('.data/foobar.db')
db.pragma('journal_mode = WAL')



export type DbGame = {
  id: GameId,
  created_at: EpochTimeStamp,
  white: UserId,
  black: UserId,
  clock: TimeControl,
  status: GameStatus,
  cycle_length: number,
  rule50_ply: number,
  board: Buffer,
  sans: string,
  halfmoves: number,
  fullmoves: number,
  turn: Color,
  castles: Buffer,
  epSquare: number | null
}

type DbGameMoveUpdate = {
  id: GameId,
  status: GameStatus,
  cycle_length: number,
  rule50_ply: number,
  board: Buffer,
  sans: string,
  halfmoves: number,
  fullmoves: number,
  turn: Color,
  castles: Buffer,
  epSquare: number | null
}

export type User = {
  id: UserId,
  created_at: EpochTimeStamp,
  seen_at: EpochTimeStamp,
  username: string,
  lichess_token: string | null,
}

export type Profile = {
  id: ProfileId,
  user_id: UserId,
  rating: number,
  nb_games: number
}

export type Session = {
    id: SessionId,
    user_id: UserId | null,
}

export const gen_id = () => {
  return Math.random().toString(16).slice(8)
}

export const create_session = (): Session => {
  return {
    id: gen_id() + gen_id(),
    user_id: null
  }
}

export const create_game = (white: UserId, black: UserId, clock: TimeControl): DbGame => {
  let d = DuckChess.default()


  return {
    id: gen_id() + gen_id().slice(0, 4),
    created_at: Date.now(),
    white,
    black,
    clock,
    status: GameStatus.Created,
    cycle_length: d.cycle_length,
    rule50_ply: d.rule50_ply,
    board: Board_encode(d.board),
    sans: '',
    halfmoves: d.halfmoves,
    fullmoves: d.fullmoves,
    turn: d.turn,
    castles: Castles_encode(d.castles),
    epSquare: d.epSquare ?? null
  }
}

export const create_user = async (): Promise<User> => {
  let username = generate_username()
  if (user_by_username(username) !== undefined) {
    username = username + gen_id().slice(0, 2)
  }
  return {
    id: gen_id(),
    created_at: Date.now(),
    seen_at: Date.now(),
    username,
    lichess_token: null
  }
}

export const create_profile = (user: User) => {
  return {
    id: gen_id(),
    user_id: user.id,
    rating: 1500,
    nb_games: 0
  }
}

async function create_databases() {
  const create_sessions = `CREATE TABLE IF NOT EXISTS 
  sessions 
  ("id" TEXT PRIMARY KEY, "user_id" TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
  )`
  const create_users = `CREATE TABLE IF NOT EXISTS 
  users 
  ("id" TEXT PRIMARY KEY, 
  "created_at" NUMBER, "seen_at" NUMBER,
  "username" TEXT, "lichess_token" TEXT)`

  const create_profiles = `CREATE TABLE IF NOT EXISTS 
  profiles 
  ("id" TEXT PRIMARY KEY, "user_id" TEXT, "rating" NUMBER, "nb_games" NUMBER,
  FOREIGN KEY (user_id) REFERENCES users(id)
  )`
  const create_games = `CREATE TABLE IF NOT EXISTS 
  games 
  ("id" TEXT PRIMARY KEY, 
  "created_at" NUMBER,
  "white" TEXT, 
  "black" TEXT, 
  "status" NUMBER,
  "cycle_length" NUMBER,
  "rule50_ply" NUMBER,
  "board" BLOB,
  "sans" TEXT,
  "halfmoves" NUMBER,
  "fullmoves" NUMBER,
  "turn" TEXT,
  "castles" BLOB,
  "epSquare" NUMBER,
  FOREIGN KEY (white) REFERENCES users(id),
  FOREIGN KEY (black) REFERENCES users(id)
  )`


  db.prepare(create_sessions).run()
  db.prepare(create_users).run()
  db.prepare(create_profiles).run()
  db.prepare(create_games).run()
  console.log('tables created')
}

create_databases()


export async function new_session(session: Session) {
    await db.prepare(`INSERT INTO sessions VALUES (@id, @user_id)`).run(session)
}

export async function session_by_id(session_id: SessionId) {
  let rows = await db.prepare<SessionId, Session>(`SELECT * from sessions WHERE id = ?`).get(session_id)
  return rows
}

export async function update_session(u: { id: SessionId, user_id: UserId }) {
  db.prepare(`UPDATE sessions SET user_id = @user_id WHERE sessions.id = @id`).run(u)
}





export async function new_game(game: DbGame) {
    await db.prepare(`INSERT INTO games VALUES (
      @id, @created_at, @white, @black, @status,
      @cycle_length, @rule50_ply, @board, @sans,
      @halfmoves, @fullmoves, @turn, @castles,
      @epSquare)`).run(game)
}

export async function game_by_id(game_id: string) {
    let rows = await db.prepare<GameId, DbGame>(`SELECT * from games WHERE id = ?`).get(game_id)
    return rows
}

export async function make_game_move(u: DbGameMoveUpdate) {
  db.prepare(`UPDATE games SET 
    status = @status, 
    cycle_length = @cycle_length,
    rule50_ply = @rule50_ply,
    board = @board, sans = @sans ,
    halfmoves = @halfmoves,
    fullmoves = @fullmoves,
    turn = @turn,
    castles = @castles,
    epSquare = @epSquare
    WHERE games.id = @id`).run(u)
}


export async function new_user(user: User) {
    await db.prepare(`INSERT INTO users VALUES 
      (@id, @created_at, @seen_at, @username, @lichess_token)`).run(user)
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
  //await db.prepare(`DELETE FROM users WHERE id = ?`).run(user_id)
}


async function new_profile(profile: Profile) {
    db.prepare(`INSERT INTO profiles VALUES (
      @id, 
      @user_id, 
      @rating, 
      @nb_games)`).run(profile)
}

export async function profile_by_username(username: string) {
    let rows = db.prepare<string, Profile>(`SELECT * from profiles INNER JOIN users ON users.id = profiles.user_id WHERE users.username = ?`)
    .get(username)

    return rows
}