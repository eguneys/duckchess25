import { Peer } from "crossws"

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
    message(_: any): void
}

export abstract class Dispatch implements IDispatch {
    constructor(readonly peer: Peer, readonly peers: Peer[], readonly on_peers_change: () => void) {}

    join() {
        this.peers.push(this.peer)
        this.on_peers_change()
    }

    leave() {
        let i = this.peers.indexOf(this.peer)
        if (i !== -1) {
            this.peers.splice(i, 1)
        }
        this.on_peers_change()
    }

    publish(data: any) {
        this.peers.forEach(_ => peer_send(_, data))
    }

    message(_: any) {}
}

