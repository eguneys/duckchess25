import crossws from 'crossws/adapters/node'
import { Peer } from 'crossws'


let lobby: Peer[] = []

function peer_send(peer: Peer, data: any) {
    if (typeof data === 'string') {
        peer.send(data)
    } else {
        peer.send(JSON.stringify(data))
    }
}

function log_error(str: string) {
    console.error(str)
}

function nb_connected_msg() {
    return { t: 'n', d: nb_connected(), r: nb_games() }
}

function nb_connected() {
    return lobby.length
}

function nb_games() {
    return 0
}

function publish_lobby(data: any) {
    lobby.forEach(_ => peer_send(_, data))
}

interface IDispatch {
    join(): void,
    leave(): void,
    message(_: string): void
}

function dispatch_peer(peer: Peer) {
    let parts = peer.request?.url?.split('/')

    if (parts) {
        let path = parts[parts.length - 1]

        switch (path) {
            case 'lobby':
                return new Lobby(peer)
        }
    }
    peer.terminate()
    return undefined
}

class Lobby {

    constructor(readonly peer: Peer) {}

    join() {
        lobby.push(this.peer)
        this.publish(nb_connected_msg())
    }

    leave() {
        let i = lobby.indexOf(this.peer)
        if (i !== -1) {
            lobby.splice(i, 1)
        }

        this.publish(nb_connected_msg())
    }

    publish(data: any) {
        lobby.forEach(_ => peer_send(_, data))
    }

    message(_: any) {
        let { t, d } = _

        switch (t) {
            case 'chat':
                let { name, text } = d

                // maybe validate
                this.publish({ t: 'chat', d: { name, text } })

                break
        }
    }
}

const ws = crossws({
    hooks: {
        open(peer) {
            let i = dispatch_peer(peer)
            i?.join()
        },
        message(peer, message) {
            if (message.text() === 'ping') {
                peer_send(peer, 0)
                return
            }

            let i = dispatch_peer(peer)
            let json
            try {
                json = message.json()
            } catch (err) {

                log_error(`[JSON Parse] ${err}`)
            }
            if (json) {
               i?.message(json)
            } 
        },
        close(peer, event) {
            let i = dispatch_peer(peer)
            i?.leave()
        },
        error(peer, error) {
            log_error(`{${peer?.request?.url}} ${error}`)
        },
    }

})

export { ws }