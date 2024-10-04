import { Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Show, Suspense } from "solid-js";
import { Game } from "~/db";
import { getGame } from "~/session";

import '~/app.scss'

export default function Home() {
    const params = useParams()

    let game = createAsync(() => getGame(params.game_id))


  return (<>
    <Suspense>
      <Show when={game()} fallback={<NotFound />}>{game =>
        <Round game={game()} />
      }</Show>
    </Suspense>
  </>)
}


function Round(_props: { game: Game }) {
    return (<>
    <main>
        <Title>Play </Title>
        Hello
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
