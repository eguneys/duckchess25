import { createContext, JSX, onCleanup, onMount } from "solid-js";

type Handlers = Record<string, (d: any) => void>

class StrongSocket {

    static create = (path: string) => {
        return new StrongSocket(path)
    }

    get href() {
        let protocol = location.protocol === 'https' ? 'wss': 'ws'
        return `${protocol}://${location.host}/_ws/${this.path}`
    }


    private default_handlers: Handlers = { ng: () => {} }
    private set_handlers: Handlers = {}

    get handlers(): Handlers {
        return {...this.default_handlers, ...this.set_handlers }
    }

    private constructor(readonly path: string) {}

    ws?: WebSocket

    ping_schedule?: NodeJS.Timeout

    connect(handlers: Handlers) {
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
            this.set_handlers = handlers
            this.log('connected to: ' + this.href)

            this.ws = ws
            this.ping_now()

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

    send(msg: any) {
        if (typeof msg === 'object') {
            this.ws?.send(JSON.stringify(msg))
        } else {
          this.ws?.send(msg)
        }
    }

    log = (msg: string) => {
        console.log(`[StrongSocket] `, msg)
    }

}

type Send = (_: any) => void
type Recieve = (_: Handlers) => void

export const SocketContext = createContext<{ send: Send, receive: Recieve}>()


export const SocketProvider = (props: { path: string, children: JSX.Element }) => {
    let handlers: Handlers = {}
    let socket = StrongSocket.create(props.path)
    let value = {
        send: (msg: any) => {
            socket.send(msg)
        },
        receive: (_handlers: Handlers) => {
            handlers = _handlers
        },
    }
    onMount(() => {
        socket.connect(handlers)
        onCleanup(() => {
            socket.destroy()
        })
    })
    return (<SocketContext.Provider value={value}>
        {props.children}
    </SocketContext.Provider>)
}