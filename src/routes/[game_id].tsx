import { Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { createMemo, createSignal, Show, Suspense } from "solid-js";
import { Game, User } from "~/db";
import { getGame, getPov, getUser } from "~/session";
import { Pov } from '~/types'

import '~/app.scss'
import { FenError, makeFen } from "duckops";
import { DuckBoard } from "~/components/DuckBoard";

export default function Home() {
    const params = useParams()

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

  const on_user_move = (uci: string) => {
    console.log(uci)
  }

  const [do_uci, set_do_uci] = createSignal<string | undefined>(undefined)
  const [do_takeback, set_do_takeback] = createSignal(undefined, { equals: false })

  const pov = createMemo(() => props.pov)
  const player = createMemo(() => pov().player)
  const orientation = createMemo(() => player().color)
  const game = createMemo(() => pov().game)
  const fen = createMemo(() => game().fen)

    return (<>
    <main>
        <Title>Play </Title>
        <DuckBoard view_only={player().color} orientation={orientation()} on_user_move={on_user_move} do_uci={do_uci()} do_takeback={do_takeback()} fen={fen()}/>
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
