import { Peer, Dispatch, Message } from "./dispatch";
import { User } from "~/db";

export class Site extends Dispatch {

    static nb_peers = 0

    constructor(user: User, peer: Peer) { super(user, 'site', peer) }

    _join() {
        Site.nb_peers += 1
    }

    _leave() {
        Site.nb_peers -= 1
    }

    async _message(_: Message) {

    }
}