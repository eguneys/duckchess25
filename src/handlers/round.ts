import { Dispatch, Message, Peer, peer_send } from "./dispatch";
import { getGame, getPov } from "../session";
import { Board, DuckChess, GameResult, makeFen, makeSan, parseFen, parseSan, parseUci, PositionHistory } from "duckops";
import { DbGame, make_game_move, make_game_outoftime, User } from "../db";
import { Board_encode, Castles_encode, GameStatus, millis_for_increment, Pov } from "../types";
import { revalidate } from "@solidjs/router";
import { RoomCrowds } from "./nb_connecteds";

async function finisher_out_of_time(pov: Pov) {
    let events = []

    let status = GameStatus.Outoftime
    let winner = pov.opponent.color


    await make_game_outoftime({
        id: pov.game.id,
        status,
        winner
    })

    events.push({ t: 'flag', d: { status, winner } })

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

    let status = GameStatus.Started

    switch (result) {
        case GameResult.WHITE_WON:
        case GameResult.BLACK_WON:
            status = GameStatus.Ended
            break
        case GameResult.DRAW:
            status = GameStatus.Ended
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
        last_move_time
    })


    events.push({ t: 'move', d: { step: { uci, san, fen }, wclock, bclock } })

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

    async get_player_ids() {
        let pov = await this.getPov()
        if (pov) {
            return [pov.player.id, pov.opponent.id]
        }
    }

    async _message(msg: Message) {

        let username = this.user.username

        let pov = await this.getPov()

        if (!pov) {
            this.terminate()
            return
        }

        switch (msg.t) {
            case 'flag': {
                let elapsed_time = Date.now() - pov.game.last_move_time
                pov.player.clock = Math.max(0, pov.player.clock - elapsed_time)

                if (pov.player.clock === 0) {
                    return this.publish_events(await finisher_out_of_time(pov))
                }
            } break
            case 'move': {
                let pov = await this.getPov()

                if (!pov) {
                    throw 'No Pov'
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