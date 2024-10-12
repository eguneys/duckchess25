import { Peer, Dispatch, Message } from "./dispatch";
import { User } from "~/db";
import { RoomCrowds } from "./nb_connecteds";

export class Site extends Dispatch {

    constructor(user: User, peer: Peer) { super(user, 'site', peer) }

    _join() {
    }

    _leave() {
    }

    async _message(_: Message) {

        switch (_.t) {
            case 'is_online': 
            let d = RoomCrowds.Instance.is_user_online(_.d)
            this.publish_peer({t: 'is_online', d})
            break
        }
    }
}