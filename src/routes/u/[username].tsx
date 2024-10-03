import { action, cache, createAsync, redirect, useAction, useParams } from "@solidjs/router"
import { Profile, profile_by_username } from "../db"
import { Title } from "@solidjs/meta"
import { createEffect, onCleanup, onMount, Show, Suspense, useContext } from "solid-js"

import "~/app.scss";
import './User.scss'
import { SocketContext, SocketProvider } from "~/components/socket"
import { getProfile, getUser, resetUser } from "~/session"

export default function Home() {
    const params = useParams()

    let { send, page, cleanup } = useContext(SocketContext)!
    onMount(() => {
        page('site')
    })


    let profile = createAsync(() => getProfile(params.username))
    let user = createAsync(() => getUser())

    let action_reset_profile = useAction(action(async() => {
        "use server"
        let user = await resetUser()

        return redirect(`/u/${user.username}`, { revalidate: ['get_user']})
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