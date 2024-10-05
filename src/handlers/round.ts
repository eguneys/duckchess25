import { Peer } from "~/ws";
import { Dispatch, peer_send } from "./dispatch";
import { getGame, getPov } from "~/session";
import { Board, DuckChess, GameResult, makeFen, makeSan, parseFen, parseSan, parseUci, PositionHistory } from "duckops";
import { DbGame, make_game_move } from "~/db";
import { Board_encode, GameStatus } from "~/types";
import { revalidate } from "@solidjs/router";

const history_step_builder = (sans: string[]) => {
    let dd = DuckChess.default()
    let history = new PositionHistory()
    history.reset(dd.board, dd.getRule50Ply(), dd.getGamePly())
    sans.reduce((last, dsan) => {
        let s = parseSan(last, dsan)
        if (!s) {
            throw "Bad History " + dsan
        }
        history.append(s)
        return history.last()
    }, history.last())
    return history
}

export class Round extends Dispatch {

    static peers: Peer[] = []

    constructor(peer: Peer, on_peers_change: () => void, readonly params: string) { super('round', peer, Round.peers, on_peers_change) }


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

    async get_peers() {
        let ids = await this.get_player_ids()
        if (ids) {
            return Round.peers.filter(_ => ids.includes(_.user.id))
        }
    }

    async publish_peers(msg: any) {
        let pp = await this.get_peers()
        if (pp) {
            pp.forEach(_ => peer_send(_, msg))
        }
    }

    async message(msg: any) {

        let username = this.user.username

        let pov = await this.getPov()

        if (!pov) {
            this.peer.terminate()
            return
        }

        switch (msg.t) {
            case 'move': {

                let history = await this.positionHistory()

                if (!history) {
                    throw 'No history'
                }

                let g = history.last()
                let uci = msg.d
                let move = parseUci(uci)

                if (!move) {
                    throw 'Bad Move ' + uci
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

                let san = makeSan(g, move)
                let board = Board_encode(history.last().board)
                pov.game.sans.push(san)
                let sans = pov.game.sans.join(' ')

                await make_game_move({ id: this.game_id, board, status, sans })

                await revalidate(getGame.keyFor(this.game_id), true)
                await revalidate(getPov.keyFor(this.game_id, this.user.id), true)

                let asdf = await getGame(this.game_id)
                console.log(getGame.keyFor(this.game_id), ' after revalidate', this.game_id, 'sans', asdf!.sans)
                console.log(getPov.keyFor(this.game_id, this.user.id))


                this.publish_peers({ t: 'move', d: uci })
            }
        }
    }

}