import { createContext, JSX, onCleanup, onMount } from "solid-js";

type Handlers = Record<string, (d: any) => void>

class StrongSocket {

    static create = () => {
        return new StrongSocket()
    }

    get href() {
        let protocol = location.protocol === 'https' ? 'wss': 'ws'
        return `${protocol}://${location.host}/_ws`
    }


    private default_handlers: Handlers = { ng: () => {} }
    private page_handlers: Handlers = {}


    add_page_handlers(_: Handlers) {
        Object.assign(this.page_handlers, _)
    }

    remove_page_handlers(_: Handlers) {
        for (let key of Object.keys(_)) {
            delete this.page_handlers[key]
        }
    }

    get handlers(): Handlers {
        return {...this.default_handlers, ...this.page_handlers }
    }

    private constructor() {}

    ws?: WebSocket

    ping_schedule?: NodeJS.Timeout

    connect() {
       this.disconnect() 

        let ws = new WebSocket(this.href)

        ws.onmessage = (e) => {
            if (e.data === '0') {
                return this.pong()
            }

            let m = JSON.parse(e.data)

            if (this.handlers[m.t]) {
                this.handlers[m.t](m.d)
            } else {
                if (m.t === 'n') {
                    this.handlers['ng'](m)
                }
            }
        }
        ws.onopen = () => {
            this.log('connected to: ' + this.href)

            this.ws = ws
            this.ping_now()

            this.send_on_connect.forEach(_ => {
                this.send(_)
            })
            this.send_on_connect = []
        }
        ws.onerror = e => this.on_error(e)
    }

    on_error = (e: Event) => {
        this.log(`error: ${e}`)
    }

    destroy = () => {
        clearTimeout(this.ping_schedule)
        this.disconnect()
        this.ws = undefined
    }

    disconnect = () => {
        if (this.ws) {
            this.ws.onerror = this.ws.onclose = this.ws.onopen = this.ws.onmessage = () => {}
            this.ws.close()
        }
    }

    ping_now = () => {
        clearTimeout(this.ping_schedule)
        this.send('ping')
    }

    schedulePing() {
        clearTimeout(this.ping_schedule)
        this.ping_schedule = setTimeout(this.ping_now, 4000)
    }

    pong = () => {
        this.schedulePing()
    }

    send_on_connect: any[] = []
    send(msg: any) {
        if (!this.ws) {
            this.send_on_connect.push(msg)
            return
        }

        if (typeof msg === 'object') {
            this.ws.send(JSON.stringify(msg))
        } else {
          this.ws.send(msg)
        }
    }

    log = (msg: string) => {
        console.log(`[StrongSocket] `, msg)
    }

}

type Send = (_: any) => void
type Receive = (_: Handlers) => void

export const SocketContext = createContext<{ send: Send, receive: Receive, cleanup: Receive, page: (path: string) => void, reconnect: () => void }>()


export const SocketProvider = (props: { children: JSX.Element }) => {
    let handlers: Handlers = {}
    let socket = StrongSocket.create()
    let value = {
        send: (msg: any) => {
            socket.send(msg)
        },
        receive: (handlers: Handlers) => {
            socket.add_page_handlers(handlers)
        },
        cleanup: (handlers: Handlers) => {
            socket.remove_page_handlers(handlers)
        },
        page: (path: string) => {
            socket.send({ t: 'page', d: path })
        },
        reconnect() {
            socket.disconnect()
            socket.connect()
        }
    }
    onMount(() => {
        socket.connect()
        onCleanup(() => {
            socket.destroy()
        })
    })
    return (<SocketContext.Provider value={value}>
        {props.children}
    </SocketContext.Provider>)
}