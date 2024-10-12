import { action, cache, createAsync, redirect, useAction, useBeforeLeave, useParams } from "@solidjs/router"
import { Profile, profile_by_username } from "../../db"
import { Title } from "@solidjs/meta"
import { createEffect, createSignal, on, onCleanup, onMount, Show, Suspense, untrack, useContext } from "solid-js"

import "~/app.scss";
import './User.scss'
import { SocketContext, SocketProvider } from "~/components/socket"
import { getUser, getUserJsonView, resetUser } from "~/components/cached"

export default function Home() {
    const params = useParams()

    let { receive, send, page, cleanup, reconnect } = useContext(SocketContext)!
    onMount(() => {
        page('site')
    })

    let user_json = createAsync(() => getUserJsonView(params.username))
    let user = createAsync(() => getUser())
    createEffect(on(() => params.username, () => {
        reconnect()
        let u = user_json()
        if (u) {
            send({ t: 'is_online', d: u.id })
        }
    }, { defer: true }))

    let action_reset_profile = useAction(action(async() => {
        "use server"
        let user = await resetUser()

        return redirect(`/u/${user.username}`, { revalidate: [getUser.key, getUserJsonView.key]})
    }))

    const [is_online, set_is_online] = createSignal(false)

    let handlers = {
        is_online(is_online: boolean) {
            set_is_online(is_online)
        }
    }

    receive(handlers)
    onCleanup(() => {
        cleanup(handlers)
    })

    return (<>
        <main class='profile'>
            <Title>{params.username}</Title>

            <div class='section'>
                <Suspense>
                    <Show when={user_json()} fallback={
                        <button onClick={() => { action_reset_profile() }}>Reset Profile</button>
                    }>{profile =>
                            <>
                                <div class='head'>
                                    <h1>
                                        <span class={'user-link ' + (is_online() ? 'online' : 'offline')}>
                                            <i class='line'></i>
                                            {params.username}</span>
                                        <span class='rating'>{profile().rating}</span>
                                    </h1>
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