import { Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { createMemo, createSignal, Show, Suspense } from "solid-js";
import { Game } from "~/db";
import { getGame, getPov } from "~/session";
import { Pov } from '~/types'
import { DuckBoard } from 'duckground'

import '~/app.scss'
import { makeFen } from "duckops";

export default function Home() {
    const params = useParams()

    let pov = createAsync(() => getPov(params.game_id))


  return (<>
    <Suspense>
      <Show when={pov()} fallback={<NotFound />}>{game =>
        <PovView pov={pov()} />
      }</Show>
    </Suspense>
  </>)
}


function PovView(props: { pov: Pov }) {

  const game = createMemo(() => props.pov.game)
  const duckchess = createMemo(() => game().duckchess)

  const fen = createMemo(() => makeFen(duckchess().toSetup()))


  const on_user_move = (uci: string) => {
    console.log(uci)
  }

    return (<>
    <main>
        <Title>Play </Title>
        <DuckBoard on_user_move={on_user_move} do_takeback={undefined} do_uci={''} fen={fen()}/>
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
