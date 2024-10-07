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

    let subbed_sid = [...peer._subscriptions].find(_ => _.includes('sid'))
    let subbed_path = [...peer._subscriptions].find(_ => _.includes('room'))

    let sid: SessionId
    let old_path = subbed_path ? subbed_path.slice(5) : undefined
    let path = subbed_path ? subbed_path.slice(5) : 'site'

    let message
    
    if (subbed_sid && subbed_path) {
        sid = subbed_sid.slice(4)
        message = JSON.parse(data)


        if (typeof message === 'object' && typeof message.path === 'string') {
            path = message.path
        }


    } else {

        let parsed

        parsed = JSON.parse(data)

        if (typeof parsed !== 'object') {
            throw 'Bad parse ' + data
        }


        if (!parsed.sid || typeof parsed.sid !== 'string' || !parsed.path || typeof parsed.path !== 'string') {
            throw 'Bad sid ' + parsed
        }

        path = parsed.path
        sid = parsed.sid
    }

    let session = await getSessionById(sid)

    if (!session) {
        throw "No session for dispatch_peer " + sid
    }

    let user = await getUserWithSession(session)

    if (!user) {
        throw "No user for dispatch_peer " + sid
    }


    console.log(old_path, path)
    if (!old_path || old_path !== path) {
        console.log('join or leave')
        if (old_path) dispatch_path(old_path, user, peer).leave()
        dispatch_path(path, user, peer).join()
        peer.subscribe('sid-' + sid)
    }

    if (message) {
        dispatch_path(path, user, peer).message(message)
    }
}


function dispatch_path(path: string, user: User, peer: Peer) {
    switch (path) {
        case 'lobby':
            return new Lobby(user, peer)
        case 'round':
            //return new Round(user, peer)
        default:
            return new Site(user, peer)
            break
    }
}