import { Dispatch, Message, Peer, peer_send } from "./dispatch";
import { getGame, getPov } from "../session";
import { Board, DuckChess, GameResult, makeFen, makeSan, parseFen, parseSan, parseUci, PositionHistory } from "duckops";
import { DbGame, make_game_move, User } from "../db";
import { Board_encode, Castles_encode, GameStatus } from "../types";
import { revalidate } from "@solidjs/router";
import { RoomCrowds } from "./nb_connecteds";

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

    async positionHistory() {
        let p = await this.getPov()
        if (!p) {
            return
        }
        return history_step_builder(p.game.sans)
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
            case 'move': {

                let history = await this.positionHistory()

                if (!history) {
                    throw 'No history'
                }

                let uci = msg.d
                let move = parseUci(uci)

                if (!move) {
                    throw 'Bad Move ' + uci
                }

                let before_game = history.last()
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
                    id: this.game_id, 
                    status,
                    cycle_length,
                    rule50_ply,
                    board,
                    sans,
                    halfmoves,
                    fullmoves,
                    turn, 
                    castles,
                    epSquare
                })

                this.publish_room({ t: 'move', d: { uci, san, fen } })
            }
        }
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