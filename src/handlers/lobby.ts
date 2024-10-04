import { Dispatch, peer_send } from "./dispatch";
import { create_game, gen_id, new_game, User, user_by_username } from "~/db";
import { getProfile } from "~/session";
import { time_controls, TimeControl } from "~/types";
import { Peer } from "~/ws";


export type Hook = {
    id: string,
    u: string,
    rating: number,
    clock: TimeControl
}

function create_hook(u: string, rating: number, clock: TimeControl) {
    return { id: gen_id(), u, rating, clock }
}

export class Lobby extends Dispatch {

    static peers: Peer[] = []

    static hooks: Hook[] = []

    static publish_lobby = (msg: any) => {
        Lobby.peers.forEach(_ => peer_send(_, msg))
    }

    constructor(peer: Peer, on_peers_change: () => void) { super(peer, Lobby.peers, on_peers_change) }

    _leave() {
        let r = Lobby.hooks.filter(_ => _.u === this.user.username)
        Lobby.hooks = Lobby.hooks.filter(_ => _.u !== this.user.username)
        this.publish({ t: 'hrem', d: r.map(_ => _.id) })
    }


    _join() {
        peer_send(this.peer, {t: 'hlist', d: Lobby.hooks.slice(0, 20)})
    }

    async message(msg: any) {
        let username = this.user.username
        let hooks = Lobby.hooks

        switch (msg.t) {
            case 'hadd': {
                if (time_controls.includes(msg.d)) {

                    let i = hooks.findIndex(_ => _.u === username && _.clock === msg.d)
                    if (i !== -1) {
                        let h = hooks.splice(i, 1)[0]
                        this.publish({ t: 'hrem', d: [h.id]})
                        return
                    }

                    let p = await getProfile(this.user.username)
                    if (!p) {
                        this.peer.terminate()
                        return
                    }

                    let hook = create_hook(username, p.rating, msg.d)
                    hooks.push(hook)
                    this.publish({ t: 'hadd', d: hook})
                }
            } break;
            case 'hjoin': {
                let i = hooks.findIndex(_ => _.id === msg.d)
                if (i !== -1) {
                    let h = hooks[i]

                    if (h.u === username) {
                        hooks.splice(i, 1)[0]
                        this.publish({ t: 'hrem', d: [h.id] })
                    } else {

                        hooks.splice(i, 1)[0]
                        this.publish({ t: 'hrem', d: [h.id] })

                        let hu = await user_by_username(h.u)

                        if (!hu) {
                            return
                        }
                        let white = this.user.id
                        let black = hu.id
                        if (Math.random() < 0.5) {
                            [white, black] = [black, white]
                        }
                        let game = create_game(white, black, h.clock)
                        await new_game(game)

                        this.publish_users({ t: 'game_redirect', d: game.id }, [white, black])

                    }
                }
            }
        }
    }
}