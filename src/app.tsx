import { MetaProvider, Title } from "@solidjs/meta";
import { A, cache, createAsync, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createEffect, Show, Suspense, useContext } from "solid-js";
import { getUser } from './session'
import { User } from "./routes/db";

import "./app.scss";


export default function App() {

  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>SolidStart - Basic</Title>
          <Nav/>
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}

const Nav = () => {
  const user = createAsync<User>(() => getUser(), { deferStream: true })

  return (<>
    <nav>
      <a class='logo' href="/">duckchess<span>.org</span></a>
      <Suspense>
        <Show when={user()}>{user =>
          <A class='dasher' href={`/u/${user().username}`}>{user().username}</A>
        }</Show>
      </Suspense>
    </nav>
  </>)
}