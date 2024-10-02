import crossws from 'crossws/adapters/node'
import { Peer } from 'crossws'
import { dispatch_peer } from './handlers'
import { peer_send } from './handlers/dispatch'

function log_error(str: string) {
    console.error(str)
}


const ws = crossws({
    hooks: {
        open(peer) {
            let i = dispatch_peer(peer)
            i?.join()
        },
        message(peer, message) {
            if (message.text() === 'ping') {
                peer_send(peer, 0)
                return
            }

            let i = dispatch_peer(peer)
            let json
            try {
                json = message.json()
            } catch (err) {

                log_error(`[JSON Parse] ${err}`)
            }
            if (json) {
               i?.message(json)
            } 
        },
        close(peer, event) {
            let i = dispatch_peer(peer)
            i?.leave()
        },
        error(peer, error) {
            log_error(`{${peer?.request?.url}} ${error}`)
        },
    }

})

export { ws }