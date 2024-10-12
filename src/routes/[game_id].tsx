import { Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, Signal, Suspense, useContext } from "solid-js";
import { DbGame, User } from "~/db";
import { getPov, getUser } from "~/components/cached";
import { Player, Pov, UserId } from '~/types'

import '~/app.scss'
import './Round.scss'


import { DuckChess, FenError, INITIAL_FEN, makeFen, makeUci, parseSan, PositionHistory } from "duckops";
import { DuckBoard } from "~/components/DuckBoard";
import { SocketContext } from "~/components/socket";
import { makeEventListener } from "@solid-primitives/event-listener";

type Step = {
  uci: string,
  san: string,
  fen: string,
  ply: number
}

class Steps {
  static make = (sans: string[]) => {
    let res = new Steps()
    let dd = DuckChess.default()
    let history = new PositionHistory()
    history.reset(dd.board, dd.getRule50Ply(), dd.getGamePly())
    sans.reduce((last, san) => {
        let s = parseSan(last, san)!
        let uci = makeUci(s)
        history.append(s)
        let l = history.last()
        let fen = makeFen(l.toSetup())

        res.add_step({uci, san, fen})

        return history.last()
    }, history.last())

    res.selected_ply = res.steps.length
    return res
  }

  add_step(step: { uci: string, san: string, fen: string}) {
    let ply = this.steps.length + 1
    this._steps[1]([...this._steps[0](), {...step, ply}])
  }

  get steps() {
    return this._steps[0]()
  }

  get selected_ply() {
    return this._i_selected_ply[0]()
  }

  get selected_fen() {
    let steps = this.steps
    let i = this.selected_ply ?? steps.length

    if (i === -1) {
      return INITIAL_FEN
    } else {
      return steps.find(_ => _.ply === i)?.fen ?? INITIAL_FEN
    }
  }

  set selected_ply(_: number) {
    this._i_selected_ply[1](_)
  }

  _i_selected_ply: Signal<number>
  _steps: Signal<Step[]>

  private constructor() {
    this._steps = createSignal<Step[]>([])
    this._i_selected_ply = createSignal(-1)
  }
}

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
    move(step: { uci: string, san: string, fen: string }) {
      steps.add_step(step)
      steps.selected_ply = steps.steps.length
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
  const [orientation, set_orientation] = createSignal(player().color)
  const steps = Steps.make(pov().game.sans)
  const fen = createMemo(() => steps.selected_fen)

  const go_to_ply = (ply: number) => {
    steps.selected_ply = ply
  }
  const selected_ply = createMemo(() => steps.selected_ply)
  const set_selected_ply = (_: number) => steps.selected_ply = _

  const view_only = createMemo(() => {
    let color = player().color

    const is_last = selected_ply() === steps.steps.length

    if (!is_last) {
      return true
    }

    return color
  })

  const can_go_prev = createMemo(() => selected_ply() > 0)
  const can_go_next = createMemo(() => selected_ply() < steps.steps.length )
  const go_to_first = () => can_go_prev() && set_selected_ply(0)
  const go_to_prev = () => can_go_prev() && set_selected_ply(selected_ply() - 1)
  const go_to_next = () => can_go_next() && set_selected_ply(selected_ply() + 1)
  const go_to_last = () => can_go_next() && set_selected_ply(steps.steps.length)

  const on_wheel = (e: WheelEvent) => {
    e.preventDefault()
    let w = Math.sign(e.deltaY)

    if (w < 0) {
      go_to_prev()
    } else {
      go_to_next()
    }
  }

  const on_key_press = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      go_to_first()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      go_to_last()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go_to_prev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go_to_next()
    } else if (e.key === 'f') {
      e.preventDefault()
      set_orientation(orientation() === 'white' ? 'black' : 'white')
    }

  }


  onMount(() => {
    let clear = []

    clear.push(makeEventListener(document, 'keydown', on_key_press))

    onCleanup(() => {
      clear.forEach(_ => _())
    })
  })



  return (<>
    <main class='round'>
      <Title>Play </Title>
      <div class='board' onWheel={e => on_wheel(e)}>
        <DuckBoard view_only={view_only()} orientation={orientation()} on_user_move={on_user_move} do_uci={do_uci()} do_takeback={do_takeback()} fen={fen()} />
      </div>
      <SideView player={player()} opponent={opponent()} steps={steps.steps} set_selected_ply={set_selected_ply} selected_ply={selected_ply()} go_to_ply={go_to_ply} />
    </main>
  </>)
}

function SideView(props: { player: Player, opponent: Player, steps: Step[], set_selected_ply: (_: number) => void, selected_ply: number, go_to_ply: (_: number) => void }) {
  const steps = createMemo(() => props.steps)
  const player = createMemo(() => props.player)
  const opponent = createMemo(() => props.opponent)

  let { crowd, cleanup } = useContext(SocketContext)!


  const is_player_online = createMemo(() => crowd().includes(player().id))
  const is_opponent_online = createMemo(() => crowd().includes(opponent().id))

  return (<>
    <div class={'user-top user-link ' + (is_player_online() ? 'online' : 'offline')}>
      <i class='line'></i>
      <span class='username'>{opponent().username}</span>
      <span class='rating'>{opponent().rating}</span>
    </div>
    <Moves {...props}/>
    <div class={'user-bot user-link ' + (is_opponent_online() ? 'online' : 'offline')}>
      <i class='line'></i>
      <span class='username'>{player().username}</span>
      <span class='rating'>{player().rating}</span>
    </div>
  </>)
}

function Moves(props: { steps: Step[], set_selected_ply: (_: number) => void, selected_ply: number, go_to_ply: (_: number) => void }) {

  const selected_ply = createMemo(() => props.selected_ply)
  const grouped = createMemo(() => {
    let ss = props.steps

    let res = []

    for (let i = 0; i < ss.length; i+= 2) {
      let r = [ss[i]]
      if (ss[i + 1]) {
        r.push(ss[i + 1])
      }
      res.push(r)
    }

    return res
  })

  let el_move: HTMLElement
  createEffect(() => {
    const ply = selected_ply()
    let cont = el_move
    if (!cont) {
      return
    }

    const target = el_move.querySelector<HTMLElement>('.selected')
    if (!target) {
      cont.scrollTop = ply ? 99999 : 0
      return
    }

    let top = target.offsetTop - cont.offsetHeight / 2 + target.offsetHeight
    cont.scrollTo({ behavior: 'instant', top })
  })

  const selected_if_ply = (ply: number) => ply === selected_ply() ? ' selected' : ''
  const set_selected_ply = (ply: number) => props.set_selected_ply(ply)

  const can_go_prev = createMemo(() => selected_ply() > 0)
  const can_go_next = createMemo(() => selected_ply() < props.steps.length )
  const go_to_first = () => can_go_prev() && set_selected_ply(0)
  const go_to_prev = () => can_go_prev() && set_selected_ply(selected_ply() - 1)
  const go_to_next = () => can_go_next() && set_selected_ply(selected_ply() + 1)
  const go_to_last = () => can_go_next() && set_selected_ply(props.steps.length)


  return (<>
  <div class='moves'>
    <div class='buttons'>
      <button class={'fbt' + (can_go_prev() ? '': ' disabled')} onClick={() => go_to_first() } data-icon=""></button>
      <button class={'fbt' + (can_go_prev() ? '': ' disabled')} onClick={() => go_to_prev() } data-icon=""></button>
      <button class={'fbt' + (can_go_next() ? '': ' disabled')} onClick={() => go_to_next() } data-icon=""></button>
      <button class={'fbt' + (can_go_next() ? '': ' disabled')} onClick={() => go_to_last() } data-icon=""></button>
    </div>
    <div ref={_ => el_move = _} class='list'>
        <For each={grouped()}>{(group, i) =>
          <>
            <span class='index'>{i() + 1}</span>
            <span onClick={() => props.go_to_ply(group[0].ply)} class={'move white' + selected_if_ply(group[0].ply)}>{group[0].san}</span>
            <Show when={group[1]}>{ g1 => 
              <span onClick={() => props.go_to_ply(group[1].ply)} class={'move black' + selected_if_ply(group[1].ply)}>{g1().san}</span>
            }</Show>
          </>
        }</For>
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
