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
