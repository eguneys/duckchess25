"use server"
import { defineWebSocket, eventHandler, getCookie } from "vinxi/http";
import { dispatch_peer } from "./handlers";
import { nb_connected_msg, socket_closed, socket_opened } from "./handlers/nb_connecteds";
import { key_for_room_channel, peer_send } from "./handlers/dispatch";

export default eventHandler({
    handler: () => {},
    websocket: defineWebSocket({
        async open(peer) {
            socket_opened()
            peer_send(peer, 0)
            peer.publish(key_for_room_channel('lobby'), nb_connected_msg())
        },
        async close(peer) {
            socket_closed()
            peer.publish(key_for_room_channel('lobby'), nb_connected_msg())
        },
        async message(peer, data) {
            let text = data.text()
            if (text === 'ping') {
                peer.send(0)
                return
            }

            dispatch_peer(peer, text)
        }
    })
})