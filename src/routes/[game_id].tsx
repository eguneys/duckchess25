import { Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, Suspense, useContext } from "solid-js";
import { DbGame, User } from "~/db";
import { getGame, getPov, getUser } from "~/session";
import { Pov } from '~/types'

import '~/app.scss'
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
    move(uci: string) {
      set_do_uci(uci)
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
  const orientation = createMemo(() => player().color)

  createEffect(() => {
    console.log(pov().game.sans)
  })
  return (<>
    <main>
        <Title>Play </Title>
        <DuckBoard view_only={player().color} orientation={orientation()} on_user_move={on_user_move} do_uci={do_uci()} do_takeback={do_takeback()} fen={pov().game.fen}/>
      </main>
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
