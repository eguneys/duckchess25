"use server"
import { getCookie, setCookie } from "vinxi/http";
import { session_by_id, game_by_id, drop_user_by_id, new_user, User, user_by_id, DbGame, create_session, new_session, update_session, Session, user_by_username, GamePlayerId, game_player_by_id, DbGamePlayer, UserPerfs, get_perfs_by_user_id, get_count_by_user_id, get_perfs_by_username } from "./db";
import { Board_decode, Castles_decode, Game, GameId, GameWithFen, LightPerf, millis_for_clock, PerfKey, Player, Pov, PovWithFen, SessionId, TimeControl, UserId, UserJsonView } from "./types";
import { Board, ByColor, Color, DuckChess, makeFen, opposite } from "duckops";
import { provisional } from "./glicko";

export type UserSession = {
  user_id: string
}

/*
export const getSession = async () => {
  "use server"
  return await useSession<UserSession>({
    password: process.env.SESSION_SECRET ?? 'secret_hash_key_placeholder_32_keys'
  })
}
  */

export const getOrCreateSession = async () => {
  let sid = getCookie('sid')
  if (sid) {
    let res = await getSessionById(sid)
    if (res) {
      return res
    }
  }

  let res = create_session()
  new_session(res)
  setCookie('sid', res.id)
  return res
}

export const getSessionById = async (sid: SessionId) => {
  return await session_by_id(sid)
}


export const resetUser = async(): Promise<User> => {
  const session = await getOrCreateSession()

  const user_id = session.user_id
  if (user_id) {
    await drop_user_by_id(user_id)
  } 


  let user = await new_user()

  await update_session({ id: session.id, user_id: user.id })
  return user
}

export const getUser = async () : Promise<User> => {

  const session = await getOrCreateSession()
  return getUserWithSession(session)
}

export const getUserWithSession = async (session: Session): Promise<User> => {

  const user_id = session.user_id
  let user: User | undefined
  if (user_id) {
    user = await user_by_id(user_id)
  } 

  if (user) {
    return user
  }

  user = await new_user()

  await update_session({ id: session.id, user_id: user.id })
  return user
}

export const getUserById = async (id: UserId): Promise<User | undefined> => {
  return await user_by_id(id)
}

export const getUserJsonViewByUsername = async (username: string): Promise<UserJsonView | undefined> => {
  let u = await user_by_username(username)
  if (!u) {
    return undefined
  }
  return getUserJsonViewByUser(u)
}

export const getUserJsonView = async (id: UserId): Promise<UserJsonView | undefined> => {
  let u = await getUserById(id)
  if (!u) {
    return undefined
  }
  return getUserJsonViewByUser(u)
}

const getUserJsonViewByUser = async (u: User): Promise<UserJsonView | undefined> => {

  let perfs = await get_perfs_by_user_id(u.id)
  let count = await get_count_by_user_id(u.id)

  if (!perfs) {
    return undefined
  }

  if (!count) {
    return undefined
  }

  return {
    id: u.id,
    username: u.username,
    perfs,
    count,
    is_online: false
  }

}

export const getGameWithFen = async (id: GameId): Promise<GameWithFen | undefined> => {

  let res = await getGame(id)

  if (!res) {
    return undefined
  }

  return {
    ...res,
    duckchess: makeFen(res.duckchess.toSetup())!
  }
}

export const getGame = async (id: GameId): Promise<Game | undefined> => {
  let g = await game_by_id(id)

  if (!g) {
    return undefined
  }

  let { status, wclock, bclock, moved_at, created_at, sans, clock } = g

  let { w_player_id, b_player_id } = g

  let white = await getGamePlayer(w_player_id)
  let black = await getGamePlayer(b_player_id, )

  if (!white || !black) {
    return undefined
  }

  let players: ByColor<Player> = { white, black }

  let duckchess = DuckChess.make(
    Board_decode(g.board),
    g.rule50_ply,
    g.cycle_length,
    g.halfmoves,
    g.fullmoves,
    g.turn,
    Castles_decode(g.castles),
    g.epSquare ?? undefined)

  return {
    id,
    duckchess,
    wclock,
    bclock,
    clock,
    created_at,
    moved_at: moved_at ?? undefined,
    sans: sans === '' ? [] : sans.split(' '),
    players,
    status
  }
}

export const getGamePlayer = async (id: GamePlayerId): Promise<Player | undefined> => {
  let p =  await game_player_by_id(id)

  if (!p) {
    return undefined
  }

  let u = await getUserById(p.user_id)

  if (!u) {
    return undefined
  }

  return {
    id: p.id,
    user_id: p.user_id,
    username: u.username,
    provisional: p.provisional === 1,
    rating: Math.floor(p.rating),
    ratingDiff: p.ratingDiff ? Math.floor(p.ratingDiff) : undefined,
    color: p.color,
    is_winner: p.is_winner === 1
  }
}

export const getLightPerf = async (user_id: UserId, key: PerfKey): Promise<LightPerf | undefined> => {
  let perfs = await get_perfs_by_user_id(user_id)

  let perf = perfs?.perfs[key]

  if (!perf) {
    return undefined
  }

  let rating = perf.gl
  let nb = perf.nb
  let progress = 0

  return {
    user_id,
    rating,
    nb,
    progress
  }
}


export const getLightPerfByUsername = async (username: string, key: PerfKey): Promise<LightPerf | undefined> => {
  let u = await user_by_username(username)

  if (!u) {
    return undefined
  }

  return getLightPerf(u.id, key)
}

export const game_pov_with_userid = async (game: Game, user_id: UserId): Promise<Pov | undefined> => {
    if (game.players.white.user_id === user_id) {
        return {
            color: 'white',
            game,
            player: game.players.white,
            opponent: game.players.black
        }
    } else if (game.players.black.user_id === user_id) {
        return {
            color: 'black',
            game,
            player: game.players.black,
            opponent: game.players.white
        }
    }
}

export const game_pov_for_watcher = async (game: Game, color: Color): Promise<Pov> => {
  return {
    color,
    game,
    player: game.players[color],
    opponent: game.players[opposite(color)]
  }
}


export const game_wfen_pov_with_userid = async (game: GameWithFen, user_id: UserId): Promise<PovWithFen | undefined> => {
    if (game.players.white.user_id === user_id) {
        return {
            color: 'white',
            game,
            player: game.players.white,
            opponent: game.players.black
        }
    } else if (game.players.black.user_id === user_id) {
        return {
            color: 'black',
            game,
            player: game.players.black,
            opponent: game.players.white
        }
    }
}

export const game_wfen_pov_for_watcher = async (game: GameWithFen, color: Color): Promise<PovWithFen> => {
  return {
    color,
    game,
    player: game.players[color],
    opponent: game.players[opposite(color)]
  }
}