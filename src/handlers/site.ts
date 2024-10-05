import { Peer } from "~/ws";
import { Dispatch } from "./dispatch";

export class Site extends Dispatch {

    static peers: Peer[] = []

    constructor(peer: Peer, on_peers_change: () => void) { super('site', peer, Site.peers, on_peers_change) }
}