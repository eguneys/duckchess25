"use server"
import { generate_username } from "./gen"
import { Board_encode, Castles_encode, GameId, GameStatus, millis_for_clock, ProfileId, SessionId, TimeControl, UserId } from './types'
import { Board, Color, DuckChess } from 'duckops'

import Database from 'better-sqlite3'


const db = new Database('.data/foobar.db')
db.pragma('journal_mode = WAL')

export type GamePlayerId = string

export type DbGamePlayer = {
  id: GamePlayerId,
  user_id: UserId,
  color: Color,
  rating: number,
  ratingDiff: number | null
}

export type DbGame = {
  id: GameId,
  created_at: EpochTimeStamp,
  w_player_id: GamePlayerId,
  b_player_id: GamePlayerId,
  clock: TimeControl,
  wclock: number,
  bclock: number,
  last_move_time: number,
  status: GameStatus,
  cycle_length: number,
  rule50_ply: number,
  board: Buffer,
  sans: string,
  halfmoves: number,
  fullmoves: number,
  turn: Color,
  castles: Buffer,
  epSquare: number | null,
  winner: Color | null
}

type DbGameEndUpdate = {
  id: GameId,
  wclock: number,
  bclock: number,
  status: GameStatus,
  winner: Color | null
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
  epSquare: number | null,
  wclock: number,
  bclock: number,
  last_move_time: number,
  winner: Color | null
}

export type User = {
  id: UserId,
  created_at: EpochTimeStamp,
  seen_at: EpochTimeStamp,
  username: string,
  lichess_token: string | null,
  is_dropped: number | null
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

const create_game_player = (user_id: UserId, color: Color, rating: number) => {
  return {
    id: gen_id(),
    user_id,
    color,
    rating,
    ratingDiff: null
  }
}


export const create_and_new_game = async (white: UserId, black: UserId, white_rating: number, black_rating: number, clock: TimeControl): Promise<DbGame> => {
  let res = create_game(white, black, white_rating, black_rating, clock)
  await new_game(res)
  return res[2]
}

const create_game = (white: UserId, black: UserId, white_rating: number, black_rating: number, clock: TimeControl): [DbGamePlayer, DbGamePlayer, DbGame] => {
  let d = DuckChess.default()
  let w_player = create_game_player(white, 'white', white_rating)
  let b_player = create_game_player(black, 'black', black_rating)

  let game = {
    id: gen_id() + gen_id().slice(0, 4),
    created_at: Date.now(),
    w_player_id: w_player.id,
    b_player_id: b_player.id,
    clock,
    wclock: millis_for_clock(clock),
    bclock: millis_for_clock(clock),
    last_move_time: Date.now(),
    status: GameStatus.Created,
    cycle_length: d.cycle_length,
    rule50_ply: d.rule50_ply,
    board: Board_encode(d.board),
    sans: '',
    halfmoves: d.halfmoves,
    fullmoves: d.fullmoves,
    turn: d.turn,
    castles: Castles_encode(d.castles),
    epSquare: d.epSquare ?? null,
    winner: null
  }

  return [w_player, b_player, game]
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
    lichess_token: null,
    is_dropped: null
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
  "username" TEXT, "lichess_token" TEXT,
  "is_dropped" NUMBER)`

  const create_profiles = `CREATE TABLE IF NOT EXISTS 
  profiles 
  ("id" TEXT PRIMARY KEY, "user_id" TEXT, "rating" NUMBER, "nb_games" NUMBER,
  FOREIGN KEY (user_id) REFERENCES users(id)
  )`

  const create_game_players = `CREATE TABLE IF NOT EXISTS 
  game_players
  ("id" TEXT PRIMARY KEY, 
  "user_id" TEXT, 
  "color" TEXT,
  "rating" NUMBER, 
  "ratingDiff" NUMBER,
  FOREIGN KEY (user_id) REFERENCES users(id)
  )`

  const create_games = `CREATE TABLE IF NOT EXISTS 
  games 
  ("id" TEXT PRIMARY KEY, 
  "created_at" NUMBER,
  "w_player_id" TEXT, 
  "b_player_id" TEXT, 
  "clock" NUMBER,
  "wclock" NUMBER,
  "bclock" NUMBER,
  "last_move_time" NUMBER,
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
  "winner" TEXT,
  FOREIGN KEY (w_player_id) REFERENCES game_players(id),
  FOREIGN KEY (b_player_id) REFERENCES game_players(id)
  )`

  db.prepare(create_sessions).run()
  db.prepare(create_users).run()
  db.prepare(create_profiles).run()
  db.prepare(create_game_players).run()
  db.prepare(create_games).run()
  console.log('tables created')
}

await create_databases()


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


export async function new_game(gamep: [DbGamePlayer, DbGamePlayer, DbGame]) {
  let [w_player, b_player, game] = gamep

    let ss = db.prepare(`INSERT INTO game_players VALUES (@id, @user_id, @color, @rating, @ratingDiff)`)
      
  await ss.run(w_player)
  await ss.run(b_player)

    await db.prepare(`INSERT INTO games VALUES (
      @id, @created_at, @w_player_id, @b_player_id, @clock,
      @wclock, @bclock, @last_move_time, @status,
      @cycle_length, @rule50_ply, @board, @sans,
      @halfmoves, @fullmoves, @turn, @castles,
      @epSquare, @winner)`).run(game)

}

export async function game_player_by_id(game_player_id: GamePlayerId) {
    let rows = await db.prepare<GamePlayerId, DbGamePlayer>(`SELECT * from game_players WHERE id = ?`).get(game_player_id)
    return rows
}

export async function game_by_id(game_id: GameId) {
    let rows = await db.prepare<GameId, DbGame>(`SELECT * from games WHERE id = ?`).get(game_id)
    return rows
}

export async function make_game_end(u: DbGameEndUpdate) {
  db.prepare(`UPDATE games SET
    status = @status,
    winner = @winner,
    wclock = @wclock,
    bclock = @bclock
   WHERE games.id = @id`).run(u)
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
    epSquare = @epSquare,
    wclock = @wclock,
    bclock = @bclock,
    last_move_time = @last_move_time,
    winner = @winner
    WHERE games.id = @id`).run(u)
}


export async function new_user(user: User) {
    await db.prepare(`INSERT INTO users VALUES 
      (@id, @created_at, @seen_at, @username, @lichess_token, @is_dropped)`).run(user)
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
  await db.prepare(`UPDATE users set is_dropped = ? where id = ?`).run(Date.now(), user_id)
}

export async function dropped_users_in_last_minute() {
  return await db.prepare<number, { id: UserId }>(`SELECT id from users WHERE is_dropped >= ?`).all(Date.now() - 1000 * 60)
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

export async function profile_by_userid(user_id: UserId) {
    let rows = db.prepare<string, Profile>(`SELECT * from profiles INNER JOIN users ON users.id = profiles.user_id WHERE users.id = ?`)
    .get(user_id)

    return rows
}