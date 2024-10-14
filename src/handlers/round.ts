import { Dispatch, Message, Peer, peer_send } from "./dispatch";
import { getGame, getPov } from "../session";
import { Board, Color, DuckChess, GameResult, makeFen, makeSan, opposite, parseFen, parseSan, parseUci, PositionHistory } from "duckops";
import { DbGame, get_perfs_by_user_id, make_game_end, make_game_move, make_game_rating_diffs, User, UserPerfs } from "../db";
import { Board_encode, Castles_encode, fen_color, Game, GameId, GameStatus, millis_for_increment, Player, Pov, UserId } from "../types";
import { revalidate } from "@solidjs/router";
import { RoomCrowds } from "./nb_connecteds";
import { Glicko_Rating, RatingDiffs } from "~/glicko";


const game_finished = (game: Game) => {
    return game.status <= GameStatus.Started
}



const pov_can_resign = (pov: Pov) => {
    return !game_finished(pov.game)
}
const pov_can_move = (pov: Pov) => {
    return !game_finished(pov.game)
}


async function update_perfs(game: Game, w_player: Player, b_player: Player) {
   if (!game_finished(game) || game.sans.length <= 2) {
    return
   }

   let w_rating = await user_api_with_perfs(w_player.user_id)
   let b_rating = await user_api_with_perfs(b_player.user_id)

   if (!w_rating || !b_rating) {
       throw "No rating for user"
   }

   let [ratingsW, ratingsB] = updateRating(w_rating, b_rating, game)


   let ratingDiffs: RatingDiffs = [ratingOf(ratingsW) - ratingOf(w_rating), ratingOf(ratingsB) - ratingOf(b_rating)]


   await game_repo_set_rating_diffs(game.id, ratingDiffs)
   await user_api_update_perfs(w_player, ratingsW, b_player, ratingsB)
}

const ratingOf = (rating: Glicko_Rating) => {
    return Math.floor(rating.rating)
}

const game_repo_set_rating_diffs = async (id: GameId, diffs: RatingDiffs) => {
    await make_game_rating_diffs(id, diffs)
}

const user_api_with_perfs = async (user_id: UserId): Promise<UserPerfs | undefined> => {
    return await get_perfs_by_user_id(user_id)
}

const user_api_update_perfs = async (white: Player, w_rating: Glicko_Rating, black: Player, b_rating: Glicko_Rating) => {
    await make_profile_rating_update(white.user_id, w_rating)
    await make_profile_rating_update(black.user_id, b_rating)
}

const updateRating = (white: Glicko_Rating, black: Glicko_Rating, game: Game) => {

    switch (game.winner) {
        case undefined: return glicko2_GameResult(white, black, true)
        case "white": return glicko2_GameResult(white, black, false)
        case "black": return glicko2_GameResult(black, white, false)
    }
}


const glicko2_GameResult = (winner: Glicko_Rating, loser: Glicko_Rating, isDraw: boolean) => {
    return [winner, loser]
}


async function finisher_out_of_time(pov: Pov) {
    let events = []

    let status = GameStatus.Outoftime
    let winner = opposite(fen_color(pov.game.fen))

    let [wclock, bclock] = [pov.player.clock, pov.opponent.clock]
    if (pov.player.color === 'black') {
        [wclock, bclock] = [bclock, wclock]
    }



    await make_game_end({
        id: pov.game.id,
        wclock,
        bclock,
        status,
        winner
    })

    let game = pov.game

    game.status = status
    game.winner = winner


    events.push({ t: 'flag', d: { status, winner } })

    let [white, black] = [pov.player, pov.opponent]

    if (pov.player.color === 'black') {
        [white, black] = [black, white]
    }

    events.push(await update_perfs(game, white, black))

    return events
}

async function finisher_other(pov: Pov, status: GameStatus, winner?: Color) {
    let events = []

    let elapsed_time = Date.now() - pov.game.last_move_time
    pov.player.clock = Math.max(0, pov.player.clock - elapsed_time)

    if (pov.player.clock === 0) {
        return await finisher_out_of_time(pov)
    }

    let [w_player, b_player] = [pov.player, pov.opponent]

    if (pov.player.color === 'black') {
        [w_player, b_player] = [b_player, w_player]
    }


    let [wclock, bclock] = [w_player.clock, b_player.clock]

    await make_game_end({
        id: pov.game.id,
        status,
        wclock,
        bclock,
        winner: winner ?? null
    })

    let game = pov.game

    game.status = status
    game.winner = winner

    events.push({ t: 'endData', d: { status, winner, clock: { wclock, bclock } } })

    events.push(await update_perfs(game, w_player, b_player))

    return events
}

async function play_uci(pov: Pov, uci: string) {

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

    pov.player.clock += millis_for_increment(pov.clock)
    let last_move_time = Date.now()

    let [wclock, bclock] = [pov.player.clock, pov.opponent.clock]
    if (pov.player.color === 'black') {
        [wclock, bclock] = [bclock, wclock]
    }

    history.append(move)
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
        winner,
        last_move_time
    })
    events.push({ t: 'move', d: { step: { uci, san, fen }, clock: { wclock, bclock } } })


    if (status !== GameStatus.Started) {
        events.push({ t: 'endData', d: { status, winner, clock: {wclock, bclock } } })
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

    async getPov() {
        return getPov(this.game_id, this.user.id)
    }

    async _message(msg: Message) {

        let username = this.user.username

        let pov = await this.getPov()

        if (!pov) {
            this.terminate()
            return
        }

        let player_color: Color | undefined = pov.player.username === username ? pov.player.color :
            pov.opponent.username === username ? pov.opponent.color : undefined

        switch (msg.t) {
            case 'resign': {
                if (player_color === undefined || !pov_can_resign(pov)) {
                    throw 'Cant Resign'
                }

                 this.publish_events(await finisher_other(pov, GameStatus.Resign, opposite(player_color)))
            } break
            case 'flag': {
                let elapsed_time = Date.now() - pov.game.last_move_time
                pov.player.clock = Math.max(0, pov.player.clock - elapsed_time)

                if (pov.player.clock === 0) {
                    return this.publish_events(await finisher_out_of_time(pov))
                }
            } break
            case 'move': {

                 if (player_color === undefined || !pov_can_move(pov)) {
                    throw 'Cant Move'
                }

                let elapsed_time = Date.now() - pov.game.last_move_time
                pov.player.clock = Math.max(0, pov.player.clock - elapsed_time)

                if (pov.player.clock === 0) {
                    return this.publish_events(await finisher_out_of_time(pov))
                }

                this.publish_events(await play_uci(pov, msg.d))
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