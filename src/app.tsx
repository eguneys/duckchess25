import { MetaProvider, Title } from "@solidjs/meta";
import { createAsync, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createEffect, Show, Suspense } from "solid-js";
import "./app.scss";
import { useSession } from "vinxi/http";
import { create_user, user_by_id, new_user, User } from './routes/db'

type UserSession = {
  user_id: string
}

export async function getUser(): Promise<User> {
  "use server"
  const session = await useSession<UserSession>({
    password: process.env.SESSION_SECRET ?? 'secret_hash_key_placeholder_32_keys'
  })


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
}


export default function App() {
  const user = createAsync(() => getUser(), { deferStream: true })

  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>SolidStart - Basic</Title>
          <nav>
            <a class='logo' href="/">duckchess<span>.org</span></a>
            <Suspense>
              <Show when={user()}>{user =>
                <a class='dasher' href="/">{user().username}</a>
              }</Show>
            </Suspense>
          </nav>
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
