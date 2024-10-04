import { cache } from "@solidjs/router";
import { useSession } from "vinxi/http";
import { game_by_id, create_user, drop_user_by_id, new_user, Profile, profile_by_username, User, user_by_id, Game } from "./db";
import { Board_decode, GameId, Player, Pov, UserId } from "./types";
import { Board, DuckChess } from "duckops";

export type UserSession = {
  user_id: string
}

export const getSession = async () => {
  "use server"
  return await useSession<UserSession>({
    password: process.env.SESSION_SECRET ?? 'secret_hash_key_placeholder_32_keys'
  })
}

export const resetUser = cache(async(): Promise<User> => {
  "use server"
  const session = await getSession()

  const user_id = session.data.user_id
  if (user_id) {
    await drop_user_by_id(user_id)
  } 


  let user = await create_user()

  await new_user(user)
  await session.update((d: UserSession) => ({ user_id: user.user_id }))
  return user
}, 'reset_user')

export const getUser = cache(async (): Promise<User> => {
  "use server"
  const session = await getSession()

  const user_id = session.data.user_id
  let user: User | undefined
  if (user_id) {
    user = await user_by_id(user_id)
  } 

  if (user) {
    return user
  }

  user = await create_user()

  await new_user(user)
  await session.update((d: UserSession) => ({ user_id: user.user_id }))
  return user
}, 'get_user')


export const getProfile = cache(async (username: string): Promise<Profile | undefined> => {
  "use server"
  return await profile_by_username(username)
}, 'get_profile')

export const getGame = cache(async (id: string): Promise<Game | undefined> => {
  "use server"
  return await game_by_id(id)
}, 'get_game')


export const getPov = cache(async (id: GameId, user_id: UserId): Promise<Pov | undefined> => {
  "use server"

  let g = await getGame(id)

  if (!g) {
    return undefined
  }

  let clock = g.clock

  let white: Player = {
    id: g.white,
    color: 'white'
  }

  let black: Player = {
    id: g.black,
    color: 'black'
  }

  let [player, opponent] = [white, black]

  if (g.black === user_id) {
    [player, opponent] = [black, white]
  }

  let duckchess = DuckChess.make(
    Board_decode(g.board),
    g.rule50_ply,
    g.cycle_length)

  let game = {
    id,
    duckchess,
    sans: g.sans.split('')
  }

  return {
    player,
    opponent,
    clock,
    game
  }
}, 'get_pov')