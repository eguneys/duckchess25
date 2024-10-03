import { IDispatch, peer_send } from './handlers/dispatch'
import { dispatch_peer } from './handlers'
import { getProfile, getSession, getUser } from './session'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket as WebSocketT, WebSocketServer } from 'ws'
import { User } from './routes/db'

function log_error(str: string) {
    console.error(str)
}


const ws = my_custom_ws_server({
    open(peer) {
        peer.dispatch.join()
    },
    message(peer, message) {
        if (message === 'ping') {
            peer_send(peer, 0)
            return
        }
        let json
        try {
            json = JSON.parse(message)
        } catch (err) {
            log_error(`[WS JSON Parse] ${err}`)
        }
        if (json) {
            if (json.t === 'page') {
                peer.dispatch.leave()
                peer.dispatch = dispatch_peer(peer, json.d)
                peer.dispatch.join()
                return
            }
            peer.dispatch.message(json)
        }
    },
    close(peer, code, reason) {
        peer.dispatch.leave()
    },
    error(peer, error) {
        log_error(`[WS Error]: ${peer.request.url} ${error}`)
    },
    upgrade() {
    }
})


export { ws }

type Hooks = {
    open(peer: Peer): void,
    message(peer: Peer, message: Message): void,
    close(peer: Peer, code: number, reason: string): void,
    error(peer: Peer, error: Error): void,
    upgrade(request: IncomingMessage): void
}

function my_custom_ws_server (hooks: Hooks) {

    const wss: WebSocketServer =
        new WebSocketServer({
            noServer: true
        })

    wss.on('connection', (ws, request) => {
        Peer.make(ws, request).then(peer => {

            hooks.open(peer)

            ws.on('message', (data) => {
                hooks.message(peer, data.toString())
            })

            ws.on('error', (error: Error) => {
                hooks.error(peer, error)
            })

            ws.on('close', (code: number, reason: Buffer) => {
                hooks.close(peer, code, reason.toString())
            })
        })
    })


    return {
        handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
            hooks.upgrade(request)
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit('connection', ws, request)
            })
        }
    }
}

type Message = string

export class Peer {

    static make = async (ws: WebSocketT, request: IncomingMessage) => {

        let user = await getUser()

        let peer = new Peer(ws, request, user)
        peer.dispatch = dispatch_peer(peer, '')
        return peer
    }

    dispatch!: IDispatch

    constructor(readonly ws: WebSocketT, 
        readonly request: IncomingMessage, 
        readonly user: User) {}


    send(data: string) {
        this.ws.send(data)
    }


    terminate() {
        this.ws.terminate()
    }
}

