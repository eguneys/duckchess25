import { Site } from "./site"
import { Lobby } from "./lobby"
import { IDispatch } from "./dispatch"
import { createAsync } from "@solidjs/router"
import { Peer } from "~/ws"

function nb_connected_msg() {
    return { t: 'n', d: nb_connected(), r: nb_games() }
}

function nb_connected() {
    return Lobby.peers.length + Site.peers.length
}

function nb_games() {
    return 0
}

export function debounce_publish_lobby() {
    Lobby.publish_lobby(nb_connected_msg())
}


export function dispatch_peer(peer: Peer, path: string): IDispatch {
    switch (path) {
        case 'lobby':
            return new Lobby(peer, debounce_publish_lobby)
        default:
            return new Site(peer, debounce_publish_lobby)
    }
}

