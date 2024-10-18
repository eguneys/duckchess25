"use server"
import { Site } from "./site"
import { Lobby } from "./lobby"
import { Round } from "./round"
import { Peer, IDispatch, Message, Dispatch, key_for_room_channel } from "./dispatch"
import { createAsync } from "@solidjs/router"
import { getSessionById, getUserWithSession } from "../session"
import { SessionId } from "~/types"
import { User } from "~/db"

export async function dispatch_peer(peer: Peer, data: string) {
    const subbed_sid = [...peer._subscriptions].find(_ => _.includes('sid'))

    let sid: SessionId

    let message = JSON.parse(data)
    
    if (subbed_sid) {
        sid = subbed_sid.slice(4)

    } else {

        if (typeof message !== 'object') {
            throw 'Bad parse ' + data
        }

        if (message.path === 'leave') {
            return
        }

        if (!message.sid || typeof message.sid !== 'string') {
            throw 'No sid ' + JSON.stringify(message)
        }

        sid = message.sid

        peer.subscribe('sid-' + sid)
    }


    let session = await getSessionById(sid)

    if (!session) {
        throw "No session for dispatch_peer " + sid
    }

    let user = await getUserWithSession(session)

    if (!user) {
        throw "No user for dispatch_peer " + sid
    }

    const subbed_path = [...peer._subscriptions].find(_ => _.includes('room'))
    let old_path = subbed_path ? subbed_path.slice(5) : undefined
    let path = subbed_path ? subbed_path.slice(5) : 'site'


    if (typeof message === 'object' && typeof message.path === 'string') {
        path = message.path
    }

    if (!old_path || old_path !== path) {
        if (old_path) await dispatch_path(old_path, user, peer).leave()
        peer.subscribe('sid-' + sid)

        if (path !== 'leave') {
            await dispatch_path(path, user, peer).join()
        }
    }

    if (message) {
        await (dispatch_path(path, user, peer).message(message))
    }
}


function dispatch_path(path: string, user: User, peer: Peer) {
    let [room, params] = path.split('&')
    switch (room) {
        case 'lobby':
            return new Lobby(user, peer)
            break
        case 'round':
            return new Round(user, peer, params)
            break
        default:
            return new Site(user, peer)
            break
    }
}