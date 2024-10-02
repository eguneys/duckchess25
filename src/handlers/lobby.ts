import { Peer } from "crossws";
import { Dispatch, peer_send } from "./dispatch";


export class Lobby extends Dispatch {

    static peers: Peer[] = []

    static publish_lobby = (msg: any) => {
        Lobby.peers.forEach(_ => peer_send(_, msg))
    }

    constructor(peer: Peer, on_peers_change: () => void) { super(peer, Lobby.peers, on_peers_change) }

    message(msg: any) {

    }
}