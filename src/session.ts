"use server"
import { getCookie, setCookie } from "vinxi/http";
import { session_by_id, game_by_id, create_user, drop_user_by_id, new_user, Profile, profile_by_username, User, user_by_id, DbGame, create_session, new_session, update_session, Session } from "./db";
import { Board_decode, Castles_decode, GameId, Player, Pov, SessionId, UserId } from "./types";
import { Board, Color, DuckChess, makeFen } from "duckops";

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


  let user = await create_user()

  await new_user(user)
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

  user = await create_user()

  await new_user(user)
  await update_session({ id: session.id, user_id: user.id })
  return user
}

export const getUserById = async (id: UserId): Promise<User | undefined> => {
  return await user_by_id(id)
}

export const getProfile = async (username: string): Promise<Profile | undefined> => {
  return await profile_by_username(username)
}

export const getGame = async (id: GameId): Promise<DbGame | undefined> => {
  return await game_by_id(id)
}

export const getPlayer = async (id: UserId, color: Color): Promise<Player | undefined> => {
  let user = await getUserById(id)

  if (!user) {
    return undefined
  }

  let profile = await getProfile(user.username)

  if (!profile) {
    return undefined
  }

  return {
    id: user.id,
    username: user.username,
    rating: profile.rating,
    color
  }
}

export const getPov = async (id: GameId, user_id: UserId): Promise<Pov | undefined> => {
  let g = await getGame(id)

  if (!g) {
    return undefined
  }

  let clock = g.clock

  let white = await getPlayer(g.white, 'white')
  let black = await getPlayer(g.black, 'black')

  if (!white || !black) {
    return undefined
  }

  let [player, opponent] = [white, black]

  if (g.black === user_id) {
    [player, opponent] = [black, white]
  }

  let duckchess = DuckChess.make(
    Board_decode(g.board),
    g.rule50_ply,
    g.cycle_length,
    g.halfmoves,
    g.fullmoves,
    g.turn,
    Castles_decode(g.castles),
    g.epSquare ?? undefined)

  let fen = makeFen(duckchess.toSetup())

  let game = {
    id,
    fen,
    sans: g.sans === '' ?  [] : g.sans.split(' '),
    status: g.status
  }

  return {
    player,
    opponent,
    clock,
    game
  }
}