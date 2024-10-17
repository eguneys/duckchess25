import { Dispatch, Message, Peer, peer_send } from "./dispatch";
import { game_pov_with_userid, getGame } from "../session";
import { Board, Color, DuckChess, GameResult, makeFen, makeSan, opposite, parseFen, parseSan, parseUci, PositionHistory } from "duckops";
import { DbGame, get_perfs_by_user_id, make_game_end, make_game_move, Perfs, User, UserPerfs } from "../db";
import { Board_encode, Castles_encode, fen_color, Game, GameId, GameStatus, millis_for_increment, perf_key_of_clock, Player, Pov, TimeControl, UserId, game_player, UserWithPerfs } from "../types";
import { revalidate } from "@solidjs/router";
import { RoomCrowds } from "./nb_connecteds";
import { Glicko_Rating, RatingDiffs, ratingOf } from "../glicko";
import { game_repo_set_rating_diffs, updateRating, user_api_update_perfs, user_api_pair_with_perfs } from "../user_api";

type Event = any
type Events = Event[]

const game_player_id_pair = (game: Game): [UserId, UserId] => {
    return [game.players.white.id, game.players.black.id]
}

const game_user_id_pair = (game: Game): [UserId, UserId] => {
    return [game.players.white.user_id, game.players.black.user_id]
}

const game_clock_update = (game: Game) => {
    let increment = millis_for_increment(game.clock)
    let elapsed = Date.now() - (game.moved_at ?? game.created_at)
    if (game_player(game).color === 'white') {
        game.wclock = Math.max(0, game.wclock - elapsed + increment)
    } else {
        game.bclock = Math.max(0, game.bclock - elapsed + increment)
    }
}

const game_finish = (game: Game, status: GameStatus, winner?: Color) => {
    game.status = status
    if (winner !== undefined) {
        game.players[winner].is_winner = true
    }

    game_clock_update(game)

    return game
}

const game_finished = (game: Game) => {
    return game.status >= GameStatus.Ended
}

const game_playing = (game: Game) => {
    return game.status <= GameStatus.Started
}

const game_can_resign = (game: Game) => {
    return game_playing(game)
}
const game_can_move = (game: Game) => {
    return game_playing(game)
}

const game_playable_by = (game: Game, color: Color) => {
    return game_playing(game) && game.duckchess.turn === color
}

const game_outoftime = (game: Game) => {
    let elapsed = Date.now() - (game.moved_at ?? game.created_at)
    if (game_player(game).color === 'white') {
        return game.wclock - elapsed <= 0
    } else {
        return game.bclock - elapsed <= 0
    }
}

const perfs_add_rating = (perfs: Perfs, gl: Glicko_Rating) => {
    return {
        id: perfs.id,
        gl_id: perfs.gl_id,
        nb: perfs.nb + 1,
        gl
    }
}

async function perfs_save(game: Game, white: UserWithPerfs, black: UserWithPerfs): Promise<RatingDiffs> {
   if (!game_finished(game) || game.sans.length <= 2) {
    return [0, 0]
   }

    let perf_key = perf_key_of_clock(game.clock)
    const ratingOf = (perfs: UserPerfs) => perfs.perfs[perf_key].gl
    const mkPerfs = (def: UserPerfs, ratings: Glicko_Rating) => {
        let res: UserPerfs = {
            id: def.id,
            perfs: { ...def.perfs }
        }

        res.perfs[perf_key] = perfs_add_rating(def.perfs[perf_key], ratings)
        return res
    }

   let [ratingsW, ratingsB] = [{...ratingOf(white.perfs)}, {...ratingOf(black.perfs)}]
   
   ;[ratingsW, ratingsB] = updateRating(ratingsW, ratingsB, game)

   let ratingDiffs: RatingDiffs = [ratingsW.rating - ratingOf(white.perfs).rating, ratingsB.rating - ratingOf(black.perfs).rating]

   let [perfsW, perfsB] = [mkPerfs(white.perfs, ratingsW), mkPerfs(black.perfs, ratingsB)]

   await game_repo_set_rating_diffs(game_player_id_pair(game), ratingDiffs)
   await user_api_update_perfs({ white: [white.perfs, perfsW], black: [black.perfs, perfsB] }, perf_key)


   return ratingDiffs
}


async function finisher_out_of_time(game: Game) {
    let winner = opposite(game_player(game).color)
    return await finisher_other(game, GameStatus.Outoftime, winner)
}

async function finisher_other(prev: Game, status: GameStatus, winner?: Color) {
    let events = []


    let game = game_finish(prev, status, winner)

    let { wclock, bclock } = prev

    await make_game_end({
        id: prev.id,
        status,
        wclock,
        bclock,
        winner: winner ? prev.players[winner].id : null
    })

    let pperfs = await user_api_pair_with_perfs(game_user_id_pair(game))

    if (!pperfs) {
        throw "No Perfs for users in game " + game.id
    }

    let [white, black] = pperfs

    let ratingDiffs = await perfs_save(game, white, black)

    events.push({ t: 'endData', d: { status, winner, clock: { wclock, bclock }, ratingDiff: { white: Math.floor(ratingDiffs[0]), black: Math.floor(ratingDiffs[1]) } } })

    return events
}

async function play_uci(pov: Pov, uci: string) {

    if (!game_playable_by(pov.game, pov.player.color)) {
        throw "Not playable by " + pov.player.color
    }

    let events = []
    let history = history_step_builder(pov.game.sans)
    let move = parseUci(uci)

    if (!move) {
        throw 'Bad Uci ' + uci
    }

    let before_game = history.last()

    if (before_game.turn !== pov.player.color) {
        throw 'Not your turn'
    }

    game_clock_update(pov.game)
    let {wclock, bclock} = pov.game

    let err = history.validate_and_append(move)


    if (err) {
        throw `Cant play ` + err
    }

    let result = history.computeGameResult()

    let status = pov.game.status
    let winner: Color | null = null


    if (status > GameStatus.Started) {
        throw 'Game status is not Started'
    }
    if (status === GameStatus.Created) {
        status = GameStatus.Started
    }


    switch (result) {
        case GameResult.WHITE_WON:
            winner = 'white'
            status = GameStatus.Ended
            break
        case GameResult.BLACK_WON:
            winner = 'black'
            status = GameStatus.Ended
            break
        case GameResult.DRAW:
            status = GameStatus.Draw
            break
        case GameResult.UNDECIDED:
            break
    }

    let last = history.last()
    let board = Board_encode(last.board)

    let san = makeSan(before_game, move)

    pov.game.sans.push(san)
    let sans = pov.game.sans.join(' ')

    let cycle_length = last.cycle_length
    let rule50_ply = last.rule50_ply
    let halfmoves = last.halfmoves
    let fullmoves = last.fullmoves
    let turn = last.turn
    let castles = Castles_encode(last.castles)
    let epSquare = last.epSquare ?? null

    let fen = makeFen(last.toSetup())

    await make_game_move({
        id: pov.game.id,
        status,
        cycle_length,
        rule50_ply,
        board,
        sans,
        halfmoves,
        fullmoves,
        turn,
        castles,
        epSquare,
        wclock,
        bclock,
        winner: winner ? pov.game.players[winner].id : null
    })
    events.push({ t: 'move', d: { step: { uci, san, fen }, clock: { wclock, bclock } } })


    if (status !== GameStatus.Started) {
        events.push(...(await finisher_other(pov.game, status, winner ?? undefined)))
    }


    return events
}

const history_step_builder = (sans: string[]) => {
    let dd = DuckChess.default()
    let history = new PositionHistory()
    history.reset(dd.board, dd.getRule50Ply(), dd.getGamePly())
    sans.reduce((last, dsan) => {
        let s = parseSan(last, dsan)
        if (!s) {
            throw `Bad History [${dsan}] for ` + sans
        }
        history.append(s)
        return history.last()
    }, history.last())
    return history

}

export class Round extends Dispatch {

    constructor(user: User, peer: Peer, readonly params: string) { super(user, `round&${params}`, peer) }

    get game_id() {
        return this.params
    }

    async with_game<A>(f: (game: Game) => Promise<A>) : Promise<A> {
        let g = await getGame(this.game_id)
        if (!g) {
            throw "No game with id " + this.game_id
        }
        return f(g)
    }

    async with_pov<A>(f: (pov?: Pov) => Promise<A>): Promise<A> {
        return this.with_game(async g => f(await game_pov_with_userid(g, this.user.id)))
    }

    async handle(op: (pov: Pov) => Promise<Events>): Promise<void> {
        return this.with_pov(pov => {
            if (pov) {
                return this.handle_and_publish(op(pov))
            }
            return Promise.reject("Bad pov request " + this.user.username)
        })
    }

    async handle_game(op: (game: Game) => Promise<Events>): Promise<void> {
        return this.with_game(game => this.handle_and_publish(op(game)))
    }

    async handle_and_publish(fu_events: Promise<Events>): Promise<void> {
        let events = await fu_events
        return this.publish_events(events)
    }

    async _message(msg: Message) {
        let username = this.user.username

        switch (msg.t) {
            case 'resign': {
                await this.handle(async pov => {
                    if (!game_can_resign(pov.game)) {
                        throw 'Cant Resign'
                    }
                    return finisher_other(pov.game, GameStatus.Resign, opposite(pov.color))
                })
            } break
            case 'flag': {
                await this.handle_game(async game => {
                    if (game_outoftime(game)) {
                        return finisher_out_of_time(game)
                    }
                    return []
                })
            } break
            case 'move': {
                await this.handle(pov => play_uci(pov, msg.d))
            }
        }
    }

    publish_events(events: any[]) {
        events.forEach(_ => this.publish_room(_))
    }

    _join() {
        let ids = RoomCrowds.Instance.get_crowd_ids(this.room)
        this.publish_room({ t: 'crowd', d: ids })
    }

    _leave() {
        let ids = RoomCrowds.Instance.get_crowd_ids(this.room)
        this.publish_room({ t: 'crowd', d: ids })
    }
}