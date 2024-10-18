import { Title } from "@solidjs/meta";
import { createEffect, createSignal, For, on, onCleanup, onMount, Show, useContext } from "solid-js";
import { SocketContext, SocketProvider } from "~/components/socket";

import "~/app.scss";
import './Home.scss'
import { Hook } from "~/handlers/lobby";
import { A, createAsync, redirect, useNavigate } from "@solidjs/router";
import { User } from "../db";
import { Leaderboard, PerfKeys, TimeControl, UserId } from "~/types";
import { getLeaderboard, getUser } from '~/components/cached'
import { getRequestProtocol } from "vinxi/http";
import { display_Glicko } from "~/glicko";
import { user_api_pair_with_perfs } from "~/user_api";

export default function Home() {

  let { page, send, receive, cleanup } = useContext(SocketContext)!

  function query_is_onlines(l: Leaderboard) {
    let ids: UserId[] = []
    if (l) {
      for (let key of PerfKeys) {
        ids.push(...l[key].map(_ => _.user_id))
      }
    }

    send({t: 'is_onlines', ids: Array.from(new Set(ids)) })
  }



  const leaderboard = createAsync(() => getLeaderboard())
  onMount(() => {
    page('lobby')
    let l = leaderboard()

    if (l) {
      query_is_onlines(l)
    }
  })

  const user = createAsync<User>(() => getUser(), { deferStream: true })

  let [ng, set_ng] = createSignal<[number, number]>([0, 0])

  const navigate = useNavigate()

  let handlers = {
    game_redirect(d: number) {
      navigate(`${d}`)
    },
    ng({ d, r}: { d: number, r: number }) {
      set_ng([d, r])
    }
  }

  receive(handlers)
  onCleanup(() => {
    cleanup(handlers)
  })


  return (
    <main class='home'>
      <Title>duckchess.org - The Forever Free, adless, open source duck chess</Title>
      <Counters ng={ng()} />
      <Lobby me={user()?.username}/>
      <Create/>
      <Featured/>
      <LeaderboardView/>
    </main>
  );
}

const Counters = (props: { ng: [number, number] }) => {

  return (<div class='counters'>
      <span><span class='bold'>{props.ng[0]}</span>online players</span>
      <span><span class='bold'>{props.ng[1] ?? 0}</span>ongoing games</span>
    </div>)
}

const clock_long: Record<TimeControl, string> = { tenzero: '10+0', threetwo: '3+2', fivefour: '5+4', twentyzero: '20+0'}

const Lobby = (props: { me?: string }) => {

  let { send, receive, cleanup } = useContext(SocketContext)!

  let [hooks, set_hooks] = createSignal<Hook[]>([], { equals: false })
  let [removed_hooks, set_removed_hooks] = createSignal<string[]>([], { equals: false })

  const join_hook = (id: string) => {
    send({ t: 'hjoin', d: id })
  }

  function clear_hooks() {

    let r = removed_hooks()
    let h = hooks()
    h = h.filter(h => !r.includes(h.id))
    set_hooks(h)
    set_removed_hooks([])
    setTimeout(clear_hooks, 1300)
  }
  clear_hooks()

  let handlers = {
    hadd(_: Hook) {
      let h = hooks()
      h.push(_)
      set_hooks(h)
    }, 
    hrem(ids: string[]) {
      let h = removed_hooks()
      h.push(...ids)
      set_removed_hooks(h)
    },
    hlist(h: Hook[]) {
      set_hooks(h)
    }
  }
  onMount(() => {
     receive(handlers)
  })
  onCleanup(() => {
    cleanup(handlers)
  })

  return (<div class='lobby'>
    <h2>Lobby</h2>
    <div class='hooks'>
      <table>
      <thead>
        <tr><th>username</th><th>rating</th><th>time</th></tr>
      </thead>
      <tbody>
        <For each={hooks()}>{hook =>
          <tr onClick={() => join_hook(hook.id)} class={
            (removed_hooks().includes(hook.id) ? ' removed': '') + 
            (hook.u === props.me ? ' me': '')}><td>{hook.u}</td><td>{hook.rating}{hook.provisional? '?' : ''}</td><td>{clock_long[hook.clock]}</td></tr>
        }</For>
      </tbody>
    </table>
    </div>
    </div>)
}

const Create = () => {

  let { send, receive, cleanup } = useContext(SocketContext)!
  let handlers = {
    hai_unavailable() {
      setTimeout(() => {
        set_pending_ai(false)
      }, 800)
    }
  }
  onMount(() => {
     receive(handlers)
  })
  onCleanup(() => {
    cleanup(handlers)
  })



  const [pending_ai, set_pending_ai] = createSignal(false)
  const [tab, set_tab] = createSignal('play')

  const onCreate = (time_control: TimeControl) => {
    let is_ai = tab() === 'ai'

    if (is_ai) {
      set_pending_ai(true)
      send({ t: 'hai', d: time_control })
    } else {
      send({ t: 'hadd', d: time_control })
    }
  }

  return (<div class='create'>
    <Show when={pending_ai()} fallback={
      <>
        <div class='opponent'>
          <h2>Opponent</h2>
          <div class='buttons'>
            <span onClick={() => set_tab('ai')} class={tab() === 'ai' ? 'active' : ''}>Play Against Computer</span>
            <span onClick={() => set_tab('play')} class={tab() === 'play' ? 'active' : ''}>Create a new game</span>
          </div>
        </div>
        <div class='content'>
          <h2>Time Control</h2>
          <div class='time-control'>
            <span onClick={() => onCreate('threetwo')}>3+2</span>
            <span onClick={() => onCreate('fivefour')}>5+4</span>
            <span onClick={() => onCreate('tenzero')}>10+0</span>
            <span onClick={() => onCreate('twentyzero')}>20+0</span>
          </div>
        </div>
      </>
    }>
      <>
        <div class='pending-ai'>
          <h3> Waiting Computer Pairing...</h3>
        </div>
      </>
    </Show>
  </div>)
}

const Featured = () => {
  return (<div class='featured'>
    <h2>Featured Game</h2>
  </div>)
}

const LeaderboardView = () => {

  let { send, receive, cleanup } = useContext(SocketContext)!


  const leaderboard = createAsync(() => getLeaderboard())

  const [is_onlines, set_is_onlines] = createSignal<{ [key in string]: boolean }[]>([])

  const is_online = (user_id: UserId) => {
    return is_onlines().some(_ => _[user_id])
  }

  let handlers = {
    is_online(ids: {[key in string]: boolean }[]) {
      set_is_onlines(ids)
    }
  }
  onMount(() => {
     receive(handlers)
  })
  onCleanup(() => {
    cleanup(handlers)
  })


  /*
  createEffect(on(leaderboard, (l: Leaderboard | undefined) => {
    if (l) {
      query_is_onlines(l)
    }
  }))
    */
  return (<div class='leaderboard'>
    <h2>Leaderboard</h2>
    <div class='perfs'>
      <For each={PerfKeys}>{key =>
        <div class='perf'>
          <h3>{key}</h3>
          <div class='list'>
            <Show when={leaderboard()}>{leaderboard =>
              < For each={leaderboard()[key]}>{leader =>
                <A class='leader' href={`/u/${leader.username}`}>
                  <span class={'user-link ' + (is_online(leader.user_id) ? 'online' : 'offline')}>
                    <i class='line'></i>
                    {leader.username}</span>
                    <span class='rating'>{display_Glicko(leader.rating)}</span>
                </A>
              }</For>
            }</Show>
          </div>
          </div>
        }</For>
    </div>
  </div>)
}