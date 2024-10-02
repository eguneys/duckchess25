import { Title } from "@solidjs/meta";
import './Home.scss'
import { createSignal, onCleanup, onMount, useContext } from "solid-js";
import { SocketContext, SocketProvider } from "~/components/socket";



export default function Home() {
  return (
  <SocketProvider path='lobby'>
    <WithSocketConnect />
  </SocketProvider>)
}

function WithSocketConnect() {

  let [ng, set_ng] = createSignal<[number, number]>([0, 0])

  let handlers = {
    ng({ d, r}: { d: number, r: number }) {
      set_ng([d, r])
    }
  }

  let {send, receive } = useContext(SocketContext)!

  receive(handlers)



  return (
    <main class='home'>
      <Title>duckchess.org - The Forever Free, adless, open source duck chess</Title>
      <Counters ng={ng()} />
      <Lobby/>
      <Create/>
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


const Lobby = () => {
  return (<div class='lobby'>
    <h2>Lobby</h2>
    <div class='hooks'>

    </div>
  </div>)
}

const Create = () => {
  return (<div class='create'>
    <h2>Time Control</h2>
    <div class='time-control'>
      <span>3+2</span>
      <span>5+4</span>
      <span>10+0</span>
      <span>20+0</span>
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