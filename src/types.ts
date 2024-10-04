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
    fen: string,
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

    let res = Buffer.alloc(72 + 4)
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