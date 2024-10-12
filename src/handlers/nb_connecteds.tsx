import { createContext, JSX } from "solid-js"
import { user_by_id } from "~/db"
import { UserId } from "~/types"

let _nb_connected = 0
let _nb_games = 0

export function nb_connected_msg() {
    return { t: 'n', d: nb_connected(), r: nb_games() }
}

function nb_connected() {
    return _nb_connected
}

function nb_games() {
    return _nb_games
}

export function socket_opened() {
    _nb_connected += 1
}

export function socket_closed() {
    _nb_connected -= 1
}


export class RoomCrowds {
    i = Math.random()

    _rooms: Map<string, Crowd> = new Map()

    get_crowd(room: string) {
        let res =  this._rooms.get(room)

        if (!res) {
            res = new Crowd()
            this._rooms.set(room, res)
        }
        return res
    }

    get nb_users() {
        let res = 0

        for (let c of this._rooms.values()) {
            res += c.nb_users
        }
        return res
    }

    get is_empty() {
        return this.nb_users === 0
    }

    is_user_online(id: UserId) {
        return [...this._rooms.values()].some(_ => _.is_user_online(id))
    }

    is_user_in_room(room: string, id: UserId) {
        let res = this._rooms.get(room)

        if (!res) {
            return false
        }

        return res.is_user_online(id)
    }
    
    connect(room: string, id: UserId) {
        let r = this._rooms.get(room)

        if (!r) {
            r = new Crowd()
            this._rooms.set(room, r)
        }

        r.connect(id)
    }


    disconnect(room: string, id: UserId) {
        let r = this._rooms.get(room)

        if (!r) {
            return
        }

        r.disconnect(id)

        if (r.is_empty) {
            this._rooms.delete(room)
        }
    }

    disconnect_all(user_id: string) {
        for (let room of this._rooms.keys()) {
            this.disconnect(room, user_id)
        }
    }
}


class Crowd {
    _users: Map<UserId, number> = new Map()

    get nb_users() {
        return this._users.size
    }

    get is_empty() {
        return this.nb_users === 0
    }

    is_user_online(id: UserId) {
        console.log('is_user_online', id, this._users)
        return this._users.has(id)
    }

    connect(id: UserId) {
        let res = this._users.get(id) ?? 0
        this._users.set(id, res + 1)
    }

    disconnect(id: UserId) {
        console.log('disconnected', this._users, id)
        let res = this._users.get(id)

        if (!res) {
            return
        }

        if (res === 1) {
            this._users.delete(id)
        } else {
            this._users.set(id, res - 1)
        }
    }
}


export const CrowdContext = createContext<RoomCrowds>()

export const Provider = (props: { children: JSX.Element }) => {
    <CrowdContext.Provider value={new RoomCrowds()}>{props.children}</CrowdContext.Provider>
}