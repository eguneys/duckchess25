import { Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, Signal, Suspense, useContext } from "solid-js";
import { DbGame, User } from "~/db";
import { getPov, getUser } from "~/components/cached";
import { fen_color, GameStatus, Player, Pov, UserId } from '~/types'

import '~/app.scss'
import './Round.scss'


import { Color, DuckChess, FenError, INITIAL_FEN, makeFen, makeUci, parseFen, parseSan, PositionHistory } from "duckops";
import { DuckBoard } from "~/components/DuckBoard";
import { SocketContext } from "~/components/socket";
import { makeEventListener } from "@solid-primitives/event-listener";
import createRAF from "@solid-primitives/raf";

type GameEndReason = {
  reason: string,
  winner?: Color
}

const capitalize = (color: Color) => color === 'black' ? 'Black' : 'White'
const opposite = (color: Color) => color === 'black' ? 'white': 'black'

const make_game_end_reason = (game: { status: GameStatus, winner?: Color }) => {
  switch (game.status) {
    case GameStatus.Aborted:
      return { reason: 'Game aborted.' }
    case GameStatus.Ended:
      return { reason: 'Game ended.', winner: game.winner }
    case GameStatus.Resign:
      return { reason: `${capitalize(opposite(game.winner!))} has resigned.`, winner: game.winner }
    case GameStatus.Outoftime:
      return { reason: `${capitalize(opposite(game.winner!))} is out of time.`, winner: game.winner }
  }
}


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

  get last_step() {
    return this.steps[this.steps.length - 1]
  }

  get last_fen() {
    return this.last_step?.fen ?? INITIAL_FEN
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
    flag(flag: { status: GameStatus, winner: Color }) {
      set_game_end_reason(make_game_end_reason(flag))
    },
    move(move: {step: { uci: string, san: string, fen: string }, clock: { wclock: number, bclock: number } } ) {
      steps.add_step(move.step)
      steps.selected_ply = steps.steps.length
      set_w_clock(move.clock.wclock)
      set_b_clock(move.clock.bclock)
    },
    endData(data: { status: GameStatus, winner?: Color, clock: { wclock: number, bclock: number }}) {
      set_game_end_reason(make_game_end_reason(data))
      set_w_clock(data.clock.wclock)
      set_b_clock(data.clock.bclock)
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
  const [wclock, set_w_clock] = createSignal(player().color === 'white' ? player().clock: opponent().clock)
  const [bclock, set_b_clock] = createSignal(player().color === 'black' ? player().clock: opponent().clock)
  const player_clock = createMemo(() => player().color === 'white' ? wclock(): bclock())
  const opponent_clock = createMemo(() => opponent().color === 'white' ? wclock(): bclock())
  const [orientation, set_orientation] = createSignal(player().color)
  const steps = Steps.make(pov().game.sans)
  const fen = createMemo(() => steps.selected_fen)


  const [game_end_reason, set_game_end_reason] = createSignal(make_game_end_reason(pov().game))
  const clock_running_color = createMemo(() => !game_end_reason() ? fen_color(steps.last_fen) : undefined)

  const go_to_ply = (ply: number) => {
    steps.selected_ply = ply
  }
  const selected_ply = createMemo(() => steps.selected_ply)
  const set_selected_ply = (_: number) => steps.selected_ply = _

  const view_only = createMemo(() => {
    if (game_end_reason()) {
      return true
    }

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


  let [can_takeback, set_can_takeback] = createSignal(false)

  let can_resign = createMemo(() => !game_end_reason())
  const set_do_resign = () => {
    send({ t: 'resign' })
  }

  return (<>
    <main class='round'>
      <Title>Play </Title>
      <div class='board' onWheel={e => on_wheel(e)}>
        <DuckBoard can_takeback={set_can_takeback} view_only={view_only()} orientation={orientation()} on_user_move={on_user_move} do_uci={do_uci()} do_takeback={do_takeback()} fen={fen()} />
      </div>
      <SideView 
        can_resign={can_resign()}
        do_resign={set_do_resign}
        game_end_reason={game_end_reason()}
        clock_running_color={clock_running_color()}
      do_takeback={set_do_takeback}
        can_takeback={can_takeback()}
        player={player()}
        opponent={opponent()}
        player_clock={player_clock()}
        opponent_clock={opponent_clock()}
        steps={steps.steps}
        set_selected_ply={set_selected_ply} selected_ply={selected_ply()} go_to_ply={go_to_ply} />
    </main>
  </>)
}

function SideView(props: { do_takeback: () => void, 
  game_end_reason?: GameEndReason,
  can_resign: boolean,
  do_resign: () => void,
  can_takeback: boolean, 
  player: Player, 
  opponent: Player, 
  player_clock: number,
  opponent_clock: number,
  clock_running_color?: Color,
  steps: Step[], 
  set_selected_ply: (_: number) => void, 
  selected_ply: number, 
  go_to_ply: (_: number) => void }) {
  const steps = createMemo(() => props.steps)
  const player = createMemo(() => props.player)
  const opponent = createMemo(() => props.opponent)

  const player_clock = createMemo(() => props.player_clock)
  const opponent_clock = createMemo(() => props.opponent_clock)

  let { crowd, cleanup } = useContext(SocketContext)!


  const is_player_online = createMemo(() => crowd().includes(player().user_id))
  const is_opponent_online = createMemo(() => crowd().includes(opponent().user_id))

  const is_player_clock_running = createMemo(() => player().color === props.clock_running_color)
  const is_opponent_clock_running = createMemo(() => opponent().color === props.clock_running_color)

  const game_end_reason = createMemo(() => props.game_end_reason)

  return (<>
    <div class='table'></div>

    <div class={'user-top user-link ' + (is_player_online() ? 'online' : 'offline')}>
      <i class='line'></i>
      <span class='username'>{opponent().username}</span>
      <span class='rating'>{opponent().rating}</span>
    </div>
    <Moves {...props}/>
    <div class='rcontrols'>
      <div class='ricons'>
        <button onClick={() => props.do_takeback()} disabled={!props.can_takeback} class='fbt takeback-yes'><span data-icon=""></span></button>
        <button onClick={() => props.do_resign()} disabled={!props.can_resign} class='fbt resign'><span data-icon=""></span></button>
      </div>
    </div>
    <div class={'user-bot user-link ' + (is_opponent_online() ? 'online' : 'offline')}>
      <i class='line'></i>
      <span class='username'>{player().username}</span>
      <span class='rating'>{player().rating}</span>
    </div>
    <div class='rclock clock-top'>
      <Time time={opponent_clock()} is_running={is_opponent_clock_running()}/>
    </div>
    <div class='rclock clock-bot'>
      <Time time={player_clock()} is_running={is_player_clock_running()}/>
    </div>
  </>)
}


function Time(props: { time: number, is_running: boolean }) {

  const { send } = useContext(SocketContext)!

  const pad2 = (num: number): string => (num < 10 ? '0' : '') + num;

  const [time, set_time] = createSignal(props.time)

  const date = createMemo(() => new Date(time()))
  let minutes = createMemo(() => pad2(date().getUTCMinutes()))
  let seconds = createMemo(() => pad2(date().getUTCSeconds()))

  createEffect(on(time, t => {
    if (t === 0) {
      send({ t: 'flag'})
    }
  }))

  createEffect(on(() => props.time, (t) => set_time(t)))

  onMount(() => {
    createEffect(on(() => props.is_running, (i => {
      if (i) {
        let now = Date.now()
        const [running, start, stop] = createRAF(() => {
          let elapsed = Date.now() - now
          set_time(Math.max(0, time() - elapsed))
          now = Date.now()

          if (time() === 0) {
            stop()
          }
        })
        start()
        onCleanup(() => {
          stop()
        })
      }
    })))
  })

  return <>  
    <div class='time'>
      {minutes()}<span>:</span>{seconds()}
    </div>
    <div class='bar'></div>
  </>
}

function Moves(props: { game_end_reason?: GameEndReason, steps: Step[], set_selected_ply: (_: number) => void, selected_ply: number, go_to_ply: (_: number) => void }) {

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
    if (props.game_end_reason) {
      el_move.scrollTop = 9999;
    }
  })

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
        <Show when={props.game_end_reason}>{reason => 
          <div class='result-wrap'>
            <Show when={reason().winner}>{winner => 
              <p class='result'> {capitalize(winner())} is victorious. </p>}</Show>
              <p class='status'>{reason().reason}</p>
          </div>
          }</Show>
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
