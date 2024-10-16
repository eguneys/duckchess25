import { Board, ByColor, Castles, Color, DuckChess, parseFen, SquareSet } from 'duckops'
import { GamePlayerId, User, UserPerfs } from './db'
import { Glicko_Rating } from './glicko'


export type Instant = number

export const fen_color = (fen: string) => parseFen(fen).unwrap().turn

export type SessionId = string
export type UserId = string
export type GameId = string
export type ProfileId = string

export const PerfKeys = ["blitz", "rapid", "classical"]
export type PerfKey = typeof PerfKeys[number]

export type UserWithPerfs = {
  user: User,
  perfs: UserPerfs
}

export type LightPerf = {
  user_id: UserId,
  rating: Glicko_Rating,
  nb: number,
  progress: number
}

export type Count = {
  draw: number,
  game: number,
  loss: number,
  win: number
}

export type UserJsonView = {
    id: UserId,
    username: string,
    is_online: boolean,
    count: Count,
    perfs: UserPerfs
}



export const time_controls = ['threetwo', 'fivefour', 'tenzero', 'twentyzero']

export type TimeControl = typeof time_controls[number]


export enum GameStatus {
  Created = 0,
  Started,
  Ended,
  Draw,
  Resign,
  Outoftime,
  Aborted,
}

export type Player = {
  id: GamePlayerId,
  color: Color,
  is_winner?: boolean,
  user_id: UserId,
  username: string,
  rating: number,
  ratingDiff?: number,
  provisional: boolean
}

export type GameBase = {
    id: GameId,
    wclock: Instant,
    bclock: Instant,
    created_at: Instant,
    sans: string[],
    status: GameStatus,
    moved_at?: Instant
    clock: TimeControl,
    players: ByColor<Player>
}

export type Game = GameBase & { duckchess: DuckChess }
export type GameWithFen = GameBase & { duckchess: string }



export type Pov = {
    player: Player,
    opponent: Player,
    game: Game,
    color: Color
}

export type PovWithFen = {
    player: Player,
    opponent: Player,
    game: GameWithFen,
    color: Color
}



export function game_player(game: Game): Player {
  return game.players[game.duckchess.turn]
}

export const game_winner = (game: GameBase) => {
    if (game.players.white.is_winner) {
        return "white"
    } else if (game.players.black.is_winner) {
        return "black"
    }
}

export const perf_key_of_clock = (clock: TimeControl): PerfKey => {
  switch (clock) {
    case "threetwo":
    case "fivefour":
      return "blitz"
    case "tenzero":
      return "rapid"
    case "twentyzero":
      return "classical"
  }
  throw ""
}

export const millis_for_increment = (clock: TimeControl) => {

  switch (clock) {
    case 'threetwo':
      return 2 * 1000
    case 'fivefour':
      return 4 * 1000
    case 'tenzero':
      return 0
    case 'twentyzero':
      return 0
  }
  return 0
}



export const millis_for_clock = (clock: TimeControl) => {

  switch (clock) {
    case 'threetwo':
      return 3 * 1000 * 60
    case 'fivefour':
      return 5 * 1000 * 60
    case 'tenzero':
      return 10 * 1000 * 60
    case 'twentyzero':
      return 20 * 1000 * 60
  }
  return 0
}


export const Castles_decode = (b: Buffer): Castles => {
    function read_square_set(offset: number) {
        let lo = b.readInt32LE(offset)
        let hi = b.readInt32LE(offset + 4)
        return new SquareSet(lo, hi)
    }
    function read_square(offset: number) {
        let res = b.readInt16LE(offset)

        if (res === -1) {
            return undefined
        }
        return res
    }

    let res = Castles.empty()

    let offset = 0
    res.castlingRights = read_square_set(offset)
    offset += 8
    res.path.black.a = read_square_set(offset)
    offset += 8
    res.path.black.h = read_square_set(offset)
    offset += 8
    res.path.white.a = read_square_set(offset)
    offset += 8
    res.path.white.h = read_square_set(offset)
    offset += 8

    res.rook.white.a = read_square(offset)
    offset += 2
    res.rook.white.h = read_square(offset)
    offset += 2
    res.rook.black.a = read_square(offset)
    offset += 2
    res.rook.black.h = read_square(offset)
    offset += 2

    return res
}


export const Castles_encode = (b: Castles): Buffer => {

    let res = Buffer.alloc(48)
    function write_square_set(set: SquareSet, offset: number) {
        res.writeInt32LE(set.lo, offset)
        res.writeInt32LE(set.hi, offset + 4)
    }

    let offset = 0

    write_square_set(b.castlingRights, offset)
    offset += 8
    write_square_set(b.path.black.a, offset)
    offset += 8
    write_square_set(b.path.black.h, offset)
    offset += 8
    write_square_set(b.path.white.a, offset)
    offset += 8
    write_square_set(b.path.white.h, offset)
    offset += 8

    res.writeInt16LE(b.rook.white.a?? -1, offset)
    offset += 2
    res.writeInt16LE(b.rook.white.h?? -1, offset)
    offset += 2
    res.writeInt16LE(b.rook.black.a?? -1, offset)
    offset += 2
    res.writeInt16LE(b.rook.black.h?? -1, offset)
    offset += 2

    return res
}



export const Board_decode = (b: Buffer): Board => {
    function read_square_set(offset: number) {
        let lo = b.readInt32LE(offset)
        let hi = b.readInt32LE(offset + 4)
        return new SquareSet(lo, hi)
    }

    let res = Board.default()

    let offset = 0

    res.occupied = read_square_set(offset)
    offset += 8
    res.white = read_square_set(offset)
    offset += 8
    res.black = read_square_set(offset)
    offset += 8
    res.pawn = read_square_set(offset)
    offset += 8
    res.knight = read_square_set(offset)
    offset += 8
    res.bishop = read_square_set(offset)
    offset += 8
    res.rook = read_square_set(offset)
    offset += 8
    res.queen = read_square_set(offset)
    offset += 8
    res.king = read_square_set(offset)
    offset += 8

    let duck = b.readInt16LE(offset)

    if (duck !== -1) {
        res.duck = duck
    }

    return res
}

export const Board_encode = (b: Board): Buffer => {

    let res = Buffer.alloc(72 + 2)
    function write_square_set(set: SquareSet, offset: number) {
        res.writeInt32LE(set.lo, offset)
        res.writeInt32LE(set.hi, offset + 4)
    }

    let offset = 0

    write_square_set(b.occupied, offset)
    offset += 8
    write_square_set(b.white, offset)
    offset += 8
    write_square_set(b.black, offset)
    offset += 8
    write_square_set(b.pawn, offset)
    offset += 8
    write_square_set(b.knight, offset)
    offset += 8
    write_square_set(b.bishop, offset)
    offset += 8
    write_square_set(b.rook, offset)
    offset += 8
    write_square_set(b.queen, offset)
    offset += 8
    write_square_set(b.king, offset)
    offset += 8

    res.writeInt16LE(b.duck?? -1, offset)
    return res
}
