"use server"
import { defineWebSocket, eventHandler, getCookie } from "vinxi/http";

export default eventHandler({
    handler: () => {},
    websocket: defineWebSocket({
        open(peer) {
            console.log('opened', peer.url)
        }
    })
})