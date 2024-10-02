import { MetaProvider, Title } from "@solidjs/meta";
import { A, cache, createAsync, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createEffect, Show, Suspense } from "solid-js";
import { useSession } from "vinxi/http";
import { create_user, user_by_id, new_user, User, drop_user_by_id } from './routes/db'

import "./app.scss";

type UserSession = {
  user_id: string
}

const getSession = async () => {
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


export default function App() {

  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>SolidStart - Basic</Title>
          <Nav/>
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}

const Nav = () => {
  const user = createAsync(() => getUser(), { deferStream: true })

  return (<>
    <nav>
      <a class='logo' href="/">duckchess<span>.org</span></a>
      <Suspense>
        <Show when={user()}>{user =>
          <A class='dasher' href={`/u/${user().username}`}>{user().username}</A>
        }</Show>
      </Suspense>
    </nav>
  </>)
}