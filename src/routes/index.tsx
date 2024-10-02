import { Title } from "@solidjs/meta";
import './Home.scss'

export default function Home() {
  return (
    <main class='home'>
      <Title>duckchess.org - The Forever Free, adless, open source duck chess</Title>
    
      <Counters />
      <Lobby/>
      <Create/>
      <Featured/>
      <Leaderboard/>
    </main>
  );
}

const Counters = () => {

  return (<div class='counters'>
      <span><span class='bold'>10</span>online players</span>
      <span><span class='bold'>10</span>ongoing games</span>
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