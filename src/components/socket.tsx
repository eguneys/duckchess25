import { createContext, createSignal, JSX, onCleanup, onMount } from "solid-js";

const getCookieValue = (name: string) => (
  document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')?.pop() || ''
)

type Handlers = Record<string, (d: any) => void>

const pingDelay = 2500
const pongTimeout = 9000

/* https://github.com/lichess-org/lila/blob/master/ui/common/src/socket.ts */
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
    connect_schedule?: NodeJS.Timeout

    _is_offline = createSignal(true)

    set_page_on_connect?: any

    get is_offline() {
        return this._is_offline[0]()
    }

    connect() {
        this.destroy()

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
            this.ws_ready_to_send = false
        }
        ws.onerror = e => this.on_error(e)
        this.scheduleConnect()
    }

    ws_ready_to_send = false

    ready_to_send() {

        if (this.set_page_on_connect) {
            this.send(this.set_page_on_connect)
        }

        this.send_on_connect.forEach(_ => {
            this.send(_)
        })
        this.send_on_connect = []


        this._is_offline[1](false)
    }

    on_error = (e: Event) => {
        this.log(`error: ${e} ${JSON.stringify(e)}`)
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
        clearTimeout(this.connect_schedule)
        this.send('ping')

        this.scheduleConnect()
    }

    scheduleConnect = (delay: number = pongTimeout) => {
        clearTimeout(this.ping_schedule)
        clearTimeout(this.connect_schedule)

        this.connect_schedule = setTimeout(() => {
            this._is_offline[1](true)
            this.connect()
        }, delay)
    }

    schedulePing() {
        clearTimeout(this.ping_schedule)
        this.ping_schedule = setTimeout(this.ping_now, pingDelay)
    }

    pong = () => {
        clearTimeout(this.connect_schedule)
        this.schedulePing()
        if (!this.ws_ready_to_send) {
            this.ws_ready_to_send = true

            this.ready_to_send()
        }
    }

    send_on_connect: any[] = []
    send(msg: any) {
        if (!this.ws || this.ws.readyState === WebSocket.CONNECTING) {
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

export const SocketContext = createContext<{ send: Send, receive: Receive, cleanup: Receive, page: (path: string, params?: string) => void, reconnect: () => void, disconnect: () => void, is_offline: () => boolean }>()


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
        page: (room: string, params?: string) => {

            let path = room
            if (params) {
                path += `&${params}`
            }
            let sid = getCookieValue('sid')
            let p = { sid, path }
            socket.set_page_on_connect = p
            socket.send(p)
        },
        reconnect() {
            socket.disconnect()
            socket.connect()
        },
        disconnect() {
            socket.disconnect()
        },
        is_offline() {
            return socket.is_offline
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