import { User } from "~/db"
import { UserId } from "~/types"
import { nb_connected_msg, RoomCrowds } from "./nb_connecteds"

export type Channel = string
export type Message = any
export type Peer = {
    _subscriptions: Set<string>,
    send: (msg: Message) => void,
    publish: (channel: Channel, msg: Message) => void,
    subscribe: (channel: Channel) => void,
    unsubscribe: (channel: Channel) => void
}


export const key_for_room_channel = (room: string) => `room-${room}`
export const key_for_users_channel = (user_id: string) => `user-${user_id}`

export function peer_send(peer: Peer, data: any) {
    if (typeof data === 'string') {
        peer.send(data)
    } else {
        peer.send(JSON.stringify(data))
    }
}



export interface IDispatch {
    _join(): void,
    _leave(): void,
    _message(_: Message): Promise<void>
}

export abstract class Dispatch implements IDispatch {

    constructor(
        readonly user: User, 
        readonly room: string, 
        readonly peer: Peer) {}

    join() {
        RoomCrowds.Instance.connect(this.room, this.user.id)
        this.peer.subscribe(key_for_users_channel(this.user.id))
        this.peer.subscribe(key_for_room_channel(this.room))

        this.publish_channel(key_for_room_channel('lobby'), nb_connected_msg())
        this._join()
    }

    leave() {
        RoomCrowds.Instance.disconnect(this.room, this.user.id)
        this.peer._subscriptions.forEach(_ => this.peer.unsubscribe(_))
        this.publish_channel(key_for_room_channel('lobby'), nb_connected_msg())
        this._leave()
    }

    publish_peer(data: Message) {
        this.peer.send(data)
    }

    publish_channel(channel: Channel, data: Message, only_rest?: true) {
        this.peer.publish(channel, data)
        if (!only_rest && this.peer._subscriptions.has(channel)) {
            this.peer.send(data)
        }
    }

    publish_room(data: Message, only_rest?: true) {
        this.publish_channel(key_for_room_channel(this.room), data, only_rest)
    }


    publish_users(data: any, users: UserId[]) {
        users.forEach(user_id => this.publish_channel(key_for_users_channel(user_id), data))
    }

    async message(message: Message) {

        this._message(message)
    }

    terminate() {
        // TODO
        // terminate peer
     }

    abstract _message(message: Message): Promise<void>
    abstract _join(): void
    abstract _leave(): void
}

