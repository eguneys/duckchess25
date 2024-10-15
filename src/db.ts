"use server"
import { generate_username } from "./gen"
import { Board_encode, Castles_encode, GameId, GameStatus, millis_for_clock, PerfKey, PerfKeys, SessionId, TimeControl, UserId } from './types'
import { Board, Color, DuckChess } from 'duckops'

import Database from 'better-sqlite3'
import { default_Glicko_Rating, Glicko_Rating } from "./glicko"
import { getUser } from "./session"


const db = new Database('.data/foobar.db')
db.pragma('journal_mode = WAL')

export type GamePlayerId = string

type DbUserPerfsId = string
type DbPerfsId = string
type DbGlickoId = string


type DbUserPerfs = {
  id: DbUserPerfsId,
  "blitz": DbPerfsId,
  "rapid": DbPerfsId,
  "classical": DbPerfsId
}

type DbPerfs = {
  id: DbUserPerfsId,
  gl: DbGlickoId,
  nb: number
}

type DbGlicko = {
  id: DbGlickoId,
  r: number,
  d: number,
  v: number
}

export type Perfs = {
  id: DbPerfsId,
  gl_id: DbGlickoId,
  gl: Glicko_Rating,
  nb: number
}

export type UserPerfs = { id: DbUserPerfsId, perfs: Record<PerfKey, Perfs> }

type DbCountId = string
export type DbCount = {
  id: DbCountId,
  draw: number,
  win: number,
  loss: number,
  game: number
}

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
  moved_at: number | null,
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
  winner: Color | null
}

export type User = {
  id: UserId,
  created_at: EpochTimeStamp,
  seen_at: EpochTimeStamp,
  username: string,
  lichess_token: string | null,
  is_dropped: number | null,
  count: DbCountId,
  perfs: DbUserPerfsId,
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
    moved_at: null,
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

const create_user = async (count: DbCountId, perfs: DbUserPerfsId): Promise<User> => {
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
    is_dropped: null,
    count,
    perfs
  }
}

async function create_databases() {

  const create_counts = `CREATE TABLE IF NOT EXISTS
  counts (
  "id" TEXT PRIMARY KEY,
  "draw" NUMBER,
  "win" NUMBER,
  "loss" NUMBER,
  "game" NUMBER
  )`

  const create_glickos = `CREATE TABLE IF NOT EXISTS
  glickos (
  "id" TEXT PRIMARY KEY,
  "r" NUMBER,
  "d" NUMBER,
  "v" NUMBER
  )`

  const create_perfs = `CREATE TABLE IF NOT EXISTS
  perfs (
  "id" TEXT PRIMARY KEY,
  "gl" TEXT,
  "nb" NUMBER,
  FOREIGN KEY (gl) REFERENCES glickos(id)
  )`

  const create_user_perfs = `CREATE TABLE IF NOT EXISTS
  user_perfs (
  "id" TEXT PRIMARY KEY,
  "blitz" TEXT,
  "rapid" TEXT,
  "classical" TEXT,
  FOREIGN KEY (blitz) REFERENCES perfs(id),
  FOREIGN KEY (rapid) REFERENCES perfs(id),
  FOREIGN KEY (classical) REFERENCES perfs(id)
  )
  `
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
  "is_dropped" NUMBER,
  "count" TEXT,
  "perfs" TEXT,
  FOREIGN KEY (count) REFERENCES counts(id),
  FOREIGN KEY (perfs) REFERENCES user_perfs(id)
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
  "moved_at" NUMBER,
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
  db.prepare(create_counts).run()
  db.prepare(create_glickos).run()
  db.prepare(create_perfs).run()
  db.prepare(create_user_perfs).run()
  db.prepare(create_users).run()
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
      @wclock, @bclock, @moved_at, @status,
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
    moved_at = @moved_at,
    winner = @winner
    WHERE games.id = @id`).run({...u, moved_at: Date.now() })
}


export async function new_user(): Promise<User> {
  let count = create_count()
  let perfs = create_user_perfs()

  let user = await create_user(count.id, perfs[0].id)

  await new_count(count)
  await new_user_perfs(perfs)

  await db.prepare(`INSERT INTO users VALUES 
      (@id, @created_at, @seen_at, 
      @username, @lichess_token, @is_dropped,
      @count,
      @perfs
      )`).run(user)

  return user
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


export async function make_game_rating_diffs(id: GameId, diffs: [number, number]) {
  throw 'make game rating diffs'
}

export async function get_perfs_of_user_by_key(user_id: UserId, key: PerfKey) {

  let db_perfs = await db.prepare<[UserId, PerfKey], DbPerfs>(`
    SELECT ? FROM user_perfs 
    INNER JOIN users ON users.perfs = user_perfs.id
    WHERE users.id = ?
    `).get(key, user_id)

  if (!db_perfs) {
    return undefined
  }

  let nb = db_perfs.nb
  let gl = await get_gl_by_id(db_perfs.gl)

  if (!gl) {
    return undefined
  }

  return {
    gl,
    nb
  }
}

export async function update_user_perfs(prev: UserPerfs, cur: UserPerfs) {
  await Promise.all(PerfKeys.map(key => {
    if (prev.perfs[key].nb !== cur.perfs[key].nb) {
      return update_perfs(cur.perfs[key])
    }
  }))
}

async function update_perfs(perfs: Perfs) {
  let [db_gl, db_perfs] = create_empty_perfs()

  db_gl.r = perfs.gl.rating
  db_gl.d = perfs.gl.deviation
  db_gl.v = perfs.gl.volatility

  db_perfs.id = perfs.id
  db_perfs.nb = perfs.nb

  await db.prepare(`INSERT INTO glickos VALUES (@id, @r, @d, @v)`).run(db_gl)
  await db.prepare(`UPDATE perfs SET gl = @gl, nb = @nb WHERE perfs.id = @id`).run(db_perfs)
  await db.prepare(`DELETE FROM glickos WHERE glickos.id = ?`).run(perfs.gl_id)
}

async function get_gl_by_id(id: DbGlickoId): Promise<Glicko_Rating | undefined> {

  let db_glicko = await db.prepare<DbGlickoId, DbGlicko>(`SELECT * FROM glickos WHERE glickos.id = ?`).get(id)


  if (!db_glicko) {
    return undefined
  }

  let { r, d, v } = db_glicko

  return {
    rating: r,
    deviation: d,
    volatility: v
  }
}

async function get_perf_by_id(id: DbPerfsId): Promise<Perfs | undefined> {

  let db_perfs = await db.prepare<DbPerfsId, DbPerfs>(`SELECT * FROM perfs WHERE perfs.id = ?`).get(id)

  if (!db_perfs) {
    return undefined
  }

  let nb = db_perfs.nb
  let gl = await get_gl_by_id(db_perfs.gl)

  if (!gl) {
    return undefined
  }

  return {
    id: db_perfs.id,
    gl_id: db_perfs.gl,
    gl,
    nb
  }
}

export async function get_perfs_by_username(username: string): Promise<UserPerfs | undefined> {
  let user = await user_by_username(username)

  if (!user) {
    return undefined
  }

  return await get_perfs_by_user_id(user.id)
}

export async function get_perfs_by_user_id(user_id: UserId): Promise<UserPerfs | undefined> {
  let user_perfs = await db.prepare<UserId, DbUserPerfs>(`SELECT user_perfs.* FROM user_perfs 
    INNER JOIN users ON users.perfs = user_perfs.id
    WHERE users.id = ?`).get(user_id)

  if (user_perfs === undefined) {
    return undefined
  }

  let blitz = await get_perf_by_id(user_perfs.blitz)
  let rapid = await get_perf_by_id(user_perfs.rapid)
  let classical = await get_perf_by_id(user_perfs.classical)

  if (!blitz || !rapid || !classical) {
    return undefined
  }

  return {
    id: user_perfs.id,
    perfs: {
      blitz,
      rapid,
      classical
    }
  }

  
}

export async function get_count_by_user_id(user_id: UserId): Promise<DbCount | undefined> {
  return await db.prepare<UserId, DbCount>(`SELECT counts.* FROM counts 
    INNER JOIN users ON users.count = counts.id 
    WHERE users.id = ?`).get(user_id)
}

const create_empty_perfs = (): [DbGlicko, DbPerfs] => {
  let glicko = default_Glicko_Rating()

  let db_glicko = {
    id: gen_id(),
    r: glicko.rating,
    d: glicko.deviation,
    v: glicko.volatility
  }

  return [db_glicko, {
    id: gen_id(),
    gl: db_glicko.id,
    nb: 0
  }]
}

const create_count = () => {
  return {
    id: gen_id(),
    draw: 0,
    win: 0,
    loss: 0,
    game: 0
  }
}

const create_user_perfs = (): [DbUserPerfs, [DbGlicko, DbPerfs][]] => {

  let [blitz, rapid, classical] = [
    create_empty_perfs(),
    create_empty_perfs(),
    create_empty_perfs()]

  return [{
    id: gen_id(),
    blitz: blitz[1].id,
    rapid: rapid[1].id,
    classical: classical[1].id
  }, [blitz, rapid, classical]
  ]
}


const new_user_perfs = async (perfs: [DbUserPerfs, [DbGlicko, DbPerfs][]]) => {
  let [user_perfs, glicko_perfs] = perfs

  const insert_into_glicko = db.prepare(`INSERT INTO glickos VALUES (@id, @r, @d, @v)`)
  const insert_into_perfs = db.prepare(`INSERT INTO perfs VALUES (@id, @gl, @nb)`)

  await Promise.all(glicko_perfs.map(([glicko, perfs]) => {
    insert_into_glicko.run(glicko)
    insert_into_perfs.run(perfs)
  }))

  await db.prepare(`INSERT INTO user_perfs VALUES (@id, @blitz, @rapid, @classical)`).run(user_perfs)
}

const new_count = async(count: DbCount) => {
  await db.prepare(`INSERT INTO counts VALUES (@id, @draw, @win, @loss, @game)`).run(count)
}