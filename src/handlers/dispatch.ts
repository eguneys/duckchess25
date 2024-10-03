import { Peer } from "~/ws"

export function peer_send(peer: Peer, data: any) {
    if (typeof data === 'string') {
        peer.send(data)
    } else {
        peer.send(JSON.stringify(data))
    }
}



export interface IDispatch {
    join(): void,
    leave(): void,
    message(_: any): Promise<void>
}

export abstract class Dispatch implements IDispatch {

    get user() {
        return this.peer.user
    }

    constructor(readonly peer: Peer, readonly peers: Peer[], readonly on_peers_change: () => void) {}

    join() {
        this.peers.push(this.peer)
        this.on_peers_change()
        this._join()
    }

    leave() {
        let i = this.peers.indexOf(this.peer)
        if (i !== -1) {
            this.peers.splice(i, 1)
        }
        this.on_peers_change()
        this._leave()
    }

    publish(data: any) {
        this.peers.forEach(_ => peer_send(_, data))
    }

    async message(_: any) {}


    _join() {}
    _leave() {}
}

