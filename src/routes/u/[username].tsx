import { action, cache, createAsync, redirect, useAction, useBeforeLeave, useParams } from "@solidjs/router"
import { Profile, profile_by_username } from "../../db"
import { Title } from "@solidjs/meta"
import { createEffect, createSignal, on, onCleanup, onMount, Show, Suspense, useContext } from "solid-js"

import "~/app.scss";
import './User.scss'
import { SocketContext, SocketProvider } from "~/components/socket"
import { getProfile, getUser, resetUser } from "~/components/cached"

export default function Home() {
    const params = useParams()

    let { send, page, cleanup, reconnect } = useContext(SocketContext)!
    onMount(() => {
        page('site')
    })

    let profile = createAsync(() => getProfile(params.username))
    let user = createAsync(() => getUser())
    createEffect(on(() => params.username, () => {
        reconnect()
    }, { defer: true }))

    let action_reset_profile = useAction(action(async() => {
        "use server"
        let user = await resetUser()

        return redirect(`/u/${user.username}`, { revalidate: [getUser.key, getProfile.key]})
    }))

    return (<>
        <main class='profile'>
            <Title>{params.username}</Title>

            <div class='section'>
                <Suspense>
                    <Show when={profile()} fallback={
                        <button onClick={() => action_reset_profile()}>Reset Profile</button>
                    }>{profile =>
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