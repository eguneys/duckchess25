const url = 'http://localhost:3131'

export const ai_status = async () => {
    return await fetch(url + '/status').then(_ => _.json())
}

export const ai_uci = async (fen: string)  => {
    let { uci } = await fetch(url + `/${encodeURIComponent(fen.replace('d', '*'))}`).then(_ => _.json())

    let [move, duck] = uci.split(',')

    return `${duck.slice(2)}@${move}`
}