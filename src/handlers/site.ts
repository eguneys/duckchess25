import { Peer, Dispatch, Message } from "./dispatch";
import { User } from "~/db";
import { RoomCrowds } from "./nb_connecteds";

export class Site extends Dispatch {

    constructor(user: User, peer: Peer) { super(user, 'site', peer) }

    async _join() {
    }

    async _leave() {
    }

    async _message(_: Message) {

    }
}