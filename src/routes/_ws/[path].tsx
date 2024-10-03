import { handleUpgrade } from '~/entry-server'
import type { APIEvent } from '@solidjs/start/server'
import { getUser } from '~/session'


export function GET(event: APIEvent) {
    let request = event.nativeEvent.node.req
    let { path } = event.params
    handleUpgrade(request)
}