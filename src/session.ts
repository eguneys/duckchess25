
import { cache } from "@solidjs/router";
import { useSession } from "vinxi/http";
import { create_user, drop_user_by_id, new_user, Profile, profile_by_username, User, user_by_id } from "./routes/db";

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


  let user = create_user()

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

  user = create_user()

  await new_user(user)
  await session.update((d: UserSession) => ({ user_id: user.user_id }))
  return user
}, 'get_user')


export const getProfile = cache(async (username: string): Promise<Profile | undefined> => {
  "use server"

  return await profile_by_username(username)
}, 'profile_by_username')

