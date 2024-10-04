import { Board, Color, DuckChess, SquareSet } from 'duckops'

export type UserId = string
export type GameId = string
export type ProfileId = string


export const time_controls = ['threetwo', 'fivefour', 'tenzero', 'twentyzero']

export type TimeControl = typeof time_controls[number]

export enum GameStatus {
  Created = 0,
  Started,
  Ended,
  Aborted
}

export type Player = {
    id: UserId,
    color: Color
}

export type Game = {
    id: GameId,
    duckchess: DuckChess,
    sans: string[]
}

export type Pov = {
    player: Player,
    opponent: Player,
    clock: TimeControl,
    game: Game
}


export const Board_decode = (b: Buffer): Board => {
    function read_square_set(offset: number) {
        let lo = b.readInt32LE(offset)
        let hi = b.readInt32LE(offset + 2)
        return new SquareSet(lo, hi)
    }

    let res = Board.default()

    let offset = 0

    res.occupied = read_square_set(offset)
    offset += 4
    res.white = read_square_set(offset)
    offset += 4
    res.black = read_square_set(offset)
    offset += 4
    res.pawn = read_square_set(offset)
    offset += 4
    res.knight = read_square_set(offset)
    offset += 4
    res.bishop = read_square_set(offset)
    offset += 4
    res.rook = read_square_set(offset)
    offset += 4
    res.queen = read_square_set(offset)
    offset += 4
    res.king = read_square_set(offset)
    offset += 4

    let duck = b.readInt16LE(offset)

    if (duck !== -1) {
        res.duck = duck
    }

    return res
}

export const Board_encode = (b: Board): Buffer => {

    let res = Buffer.alloc(38)
    function write_square_set(set: SquareSet, offset: number) {
        res.writeInt32LE(set.lo, offset)
        res.writeInt32LE(set.hi, offset + 2)
    }

    let offset = 0

    write_square_set(b.occupied, offset)
    offset += 4
    write_square_set(b.white, offset)
    offset += 4
    write_square_set(b.black, offset)
    offset += 4
    write_square_set(b.pawn, offset)
    offset += 4
    write_square_set(b.knight, offset)
    offset += 4
    write_square_set(b.bishop, offset)
    offset += 4
    write_square_set(b.rook, offset)
    offset += 4
    write_square_set(b.queen, offset)
    offset += 4
    write_square_set(b.king, offset)
    offset += 4

    res.writeInt16LE(b.duck?? -1, offset)

    return res

}