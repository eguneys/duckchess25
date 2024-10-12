import { Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, Suspense, useContext } from "solid-js";
import { DbGame, User } from "~/db";
import { getPov, getUser } from "~/components/cached";
import { Player, Pov } from '~/types'

import '~/app.scss'
import './Round.scss'


import { FenError, makeFen } from "duckops";
import { DuckBoard } from "~/components/DuckBoard";
import { SocketContext } from "~/components/socket";

export default function Round() {

  const params = useParams()

  let { page } = useContext(SocketContext)!
  onMount(() => {
    page('round', params.game_id)
  })


  const user = createAsync<User>(() => getUser())
  let pov = createAsync(() => getPov(params.game_id, user()?.id ?? 'black'))

  return (<>
    <Suspense>
      <Show when={pov()} fallback={<NotFound />}>{pov =>
      <PovView pov={pov()}/>
      }</Show>
    </Suspense>
  </>)
}


function PovView(props: { pov: Pov }) {


  let { send, page, receive, cleanup } = useContext(SocketContext)!

  let handlers = {
    move(d: { uci: string, san: string, fen: string }) {
      set_do_uci(d.uci)
    }
  }

  receive(handlers)
  onCleanup(() => {
    cleanup(handlers)
  })




  const on_user_move = (uci: string) => {
    send({ t: 'move', d: uci })
  }

  const [do_uci, set_do_uci] = createSignal<string | undefined>(undefined)
  const [do_takeback, set_do_takeback] = createSignal(undefined, { equals: false })

  const pov = createMemo(() => props.pov)
  const player = createMemo(() => pov().player)
  const opponent = createMemo(() => pov().opponent)
  const orientation = createMemo(() => player().color)

  return (<>
    <main class='round'>
      <Title>Play </Title>
      <div class='board'>
        <DuckBoard view_only={player().color} orientation={orientation()} on_user_move={on_user_move} do_uci={do_uci()} do_takeback={do_takeback()} fen={pov().game.fen} />
      </div>
      <SideView player={player()} opponent={opponent()} />
    </main>
  </>)
}

function SideView(props: { player: Player, opponent: Player }) {
  const player = createMemo(() => props.player)
  const opponent = createMemo(() => props.opponent)
  return (<>
    <div class='user-top user-link online'>
      <i class='line'></i>
      <span class='username'>{opponent().username}</span>
      <span class='rating'>{opponent().rating}</span>
    </div>
    <Moves />
    <div class='user-bot user-link offline'>
      <i class='line'></i>
      <span class='username'>{player().username}</span>
      <span class='rating'>{player().rating}</span>
    </div>
  </>)
}

function Moves() {
  return (<>
  <div class='moves'>
    <div class='buttons'></div>
    <div class='list'>

    </div>
  </div>
  </>)
}

function NotFound() {
  return (
    <main>
      <Title>404 Not Found</Title>
      <HttpStatusCode code={404} />
      <h1>Page Not Found</h1>
      <p>
        <A href='/'>Go back to homepage.</A>
      </p>
    </main>
  );
}
