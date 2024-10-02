import { action, cache, createAsync, redirect, useAction, useParams } from "@solidjs/router"
import { Profile, profile_by_username } from "../db"
import { Title } from "@solidjs/meta"
import { createEffect, Show, Suspense, useContext } from "solid-js"
import { getUser, resetUser } from '~/app'

import './User.scss'
import { SocketContext, SocketProvider } from "~/components/socket"

const getProfile = cache(async (username: string): Promise<Profile | undefined> => {
  "use server"

  return await profile_by_username(username)
}, 'profile_by_username')

export default function Home() {
  return (
  <SocketProvider path='site'>
    <WithSocketConnect />
  </SocketProvider>)
}



const WithSocketConnect = () => {

    let handlers = {}

    let { send, receive } = useContext(SocketContext)!

    receive(handlers)



    const params = useParams()

    let profile = createAsync(() => getProfile(params.username))
    let user = createAsync(() => getUser())

    let action_reset_profile = useAction(action(async() => {
        "use server"
        let user = await resetUser()
        throw redirect(`/u/${user.username}`, { revalidate: ['get_user']})
    }))

    return (<>
        <main class='profile'>
            <Title>{params.username}</Title>

            <div class='section'>
                <Suspense>
                    <Show when={profile()}>{profile =>
                        <>
                            <div class='head'>
                                <div class='username'>{params.username}
                                    <span class='rating'>{profile().rating}</span>
                                </div>
                                <div class='tools'>
                                    <Show when={user()?.username === params.username}>
                                        <button onClick={() => action_reset_profile()}>Reset Profile</button>
                                    </Show>
                                </div>
                            </div>
                            <p class='activity'>{profile().nb_games} games played.</p>
                        </>
                    }</Show>
                </Suspense>
            </div>
        </main>
    </>)
}