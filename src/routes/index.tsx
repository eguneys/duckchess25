import { Title } from "@solidjs/meta";
import { createSignal, For, onCleanup, onMount, useContext } from "solid-js";
import { SocketContext, SocketProvider } from "~/components/socket";

import "~/app.scss";
import './Home.scss'
import { Hook, TimeControl } from "~/handlers/lobby";
import { createAsync } from "@solidjs/router";
import { getUser } from "~/session";
import { User } from "./db";

export default function Home() {
  return (
  <SocketProvider path='lobby'>
    <WithSocketConnect />
  </SocketProvider>)
}

function WithSocketConnect() {

  const user = createAsync<User>(() => getUser(), { deferStream: true })

  let [ng, set_ng] = createSignal<[number, number]>([0, 0])


  let handlers = {
    ng({ d, r}: { d: number, r: number }) {
      set_ng([d, r])
    }
  }

  let { send, receive } = useContext(SocketContext)!
  receive(handlers)

  const on_create = (time_control: TimeControl) => {
    send({ t: 'hadd', d: time_control })
  }
  

  return (
    <main class='home'>
      <Title>duckchess.org - The Forever Free, adless, open source duck chess</Title>
      <Counters ng={ng()} />
      <Lobby me={user()?.username}/>
      <Create onCreate={(clock) => on_create(clock)}/>
      <Featured/>
      <Leaderboard/>
    </main>
  );
}

const Counters = (props: { ng: [number, number] }) => {

  return (<div class='counters'>
      <span><span class='bold'>{props.ng[0]}</span>online players</span>
      <span><span class='bold'>{props.ng[1] ?? 0}</span>ongoing games</span>
    </div>)
}

const clock_long = { tenzero: '10+0', threetwo: '3+2', fivefour: '5+4', twentyzero: '20+0'}

const Lobby = (props: { me?: string }) => {

  let { send, receive } = useContext(SocketContext)!

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
    hrem(id: string[]) {
      let h = removed_hooks()
      h.push(...id)
      set_removed_hooks(h)
    },
    hlist(h: Hook[]) {
      set_hooks(h)
    }
  }
  receive(handlers)

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
            (hook.u === props.me ? ' me': '')}><td>{hook.u}</td><td>{hook.rating}</td><td>{clock_long[hook.clock]}</td></tr>
        }</For>
      </tbody>
    </table>
    </div>
    </div>)
}

const Create = (props: { onCreate: (time_control: TimeControl) => void }) => {
  return (<div class='create'>
    <h2>Time Control</h2>
    <div class='time-control'>
      <span onClick={() => props.onCreate('threetwo')}>3+2</span>
      <span onClick={() => props.onCreate('fivefour')}>5+4</span>
      <span onClick={() => props.onCreate('tenzero')}>10+0</span>
      <span onClick={() => props.onCreate('twentyzero')}>20+0</span>
    </div>
  </div>)
}

const Featured = () => {
  return (<div class='featured'>
    Featured Active Game
  </div>)
}

const Leaderboard = () => {
  return (<div class='leaderboard'>
    Leaderboard
  </div>)
}