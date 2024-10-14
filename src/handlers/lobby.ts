import { Peer, Dispatch, peer_send, Message } from "./dispatch";
import { create_and_new_game, gen_id, new_game, User, user_by_username } from "../db";
import { getProfile, getProfileByUserId } from "../session";
import { time_controls, TimeControl } from "../types";


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
            case 'hadd': {
                if (time_controls.includes(msg.d)) {

                    let i = hooks.findIndex(_ => _.u === username && _.clock === msg.d)
                    if (i !== -1) {
                        let h = hooks.splice(i, 1)[0]
                        this.publish_room({ t: 'hrem', d: [h.id]})
                        return
                    }

                    let p = await getProfile(this.user.username)
                    if (!p) {
                        this.terminate()
                        return
                    }

                    let hook = create_hook(username, p.rating, msg.d)
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
                        let white = await getProfileByUserId(this.user.id)
                        let black = await getProfileByUserId(hu.id)

                        if (!white || !black) {
                            throw "No Profile for hook match"
                        }

                        if (Math.random() < 0.5) {
                            [white, black] = [black, white]
                        }


                        let game = await create_and_new_game(white.user_id, black.user_id, white.rating, black.rating, h.clock)

                        this.publish_users({ t: 'game_redirect', d: game.id }, [white.user_id, black.user_id])

                    }
                }
            }
        }
    }
}