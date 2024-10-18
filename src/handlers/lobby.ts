import { Peer, Dispatch, peer_send, Message } from "./dispatch";
import { ai_all, create_and_new_game, gen_id, new_game, User, user_by_username } from "../db";
import { perf_key_of_clock, time_controls, TimeControl, UserId } from "../types";
import { getLightPerf, getLightPerfByUsername } from "../session";
import { Glicko_Rating, provisional } from "../glicko";


export type Hook = {
    id: string,
    u: string,
    rating: number,
    clock: TimeControl,
    provisional: boolean
}

function create_hook(u: string, rating: Glicko_Rating, clock: TimeControl) {
    return { id: gen_id(), u, rating: Math.floor(rating.rating), clock, provisional: provisional(rating) }
}

export class Lobby extends Dispatch {

    static nb_peers = 0

    static hooks: Hook[] = []

    constructor(user: User, peer: Peer) { super(user, 'lobby', peer) }

    _leave() {
        Lobby.nb_peers -= 1
        let r = Lobby.hooks.filter(_ => _.u === this.user.username)
        Lobby.hooks = Lobby.hooks.filter(_ => _.u !== this.user.username)
        this.publish_room({ t: 'hrem', d: r.map(_ => _.id) })
    }


    _join() {
        Lobby.nb_peers += 1
        peer_send(this.peer, {t: 'hlist', d: Lobby.hooks.slice(0, 20)})
    }

    async _message(msg: Message) {
        let username = this.user.username
        let hooks = Lobby.hooks

        switch (msg.t) {
            case 'hai': {

                let clock = msg.d
                if (time_controls.includes(msg.d)) {
                    let ais = await ai_all()
                    let ai = ais[Math.round(Math.random() * (ais.length - 1))]
                    await this.start_new_game_against_user(ai.id, clock)


                    // this.publish_peer({ t: 'hai_unavailable' })
                }

            } break
            case 'hadd': {
                if (time_controls.includes(msg.d)) {
                    let clock = msg.d

                    let i = hooks.findIndex(_ => _.u === username && _.clock === clock)
                    if (i !== -1) {
                        let h = hooks.splice(i, 1)[0]
                        this.publish_room({ t: 'hrem', d: [h.id]})
                        return
                    }

                    let perf = await getLightPerfByUsername(this.user.username, perf_key_of_clock(clock))
                    if (!perf) {
                        throw "No Light Perf for user " + this.user.username
                    }

                    let hook = create_hook(username, perf.rating, msg.d)
                    hooks.push(hook)
                    this.publish_room({ t: 'hadd', d: hook})
                }
            } break;
            case 'hjoin': {
                let i = hooks.findIndex(_ => _.id === msg.d)
                if (i !== -1) {
                    let h = hooks[i]

                    if (h.u === username) {
                        hooks.splice(i, 1)[0]
                        this.publish_room({ t: 'hrem', d: [h.id] })
                    } else {

                        hooks.splice(i, 1)[0]
                        this.publish_room({ t: 'hrem', d: [h.id] })

                        let hu = await user_by_username(h.u)

                        if (!hu) {
                            throw "No user for hook match"
                        }

                        await this.start_new_game_against_user(hu.id, h.clock)
                    }
                }
            }
        }
    }

    start_new_game_against_user = async (opponent_id: UserId, clock: TimeControl) => {

        let perf_key = perf_key_of_clock(clock)
        let white = await getLightPerf(this.user.id, perf_key)
        let black = await getLightPerf(opponent_id, perf_key)

        if (!white || !black) {
            throw "No Light Perf for hook match"
        }

        if (Math.random() < 0.5) {
            [white, black] = [black, white]
        }


        let game = await create_and_new_game(white.user_id, black.user_id, white.rating, black.rating, clock)

        this.publish_users({ t: 'game_redirect', d: game.id }, [white.user_id, black.user_id])
    }
}