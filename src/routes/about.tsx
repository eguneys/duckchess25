import { Title } from "@solidjs/meta";
import '~/app.scss'
import './About.scss'

export default function Home() {
  return (
    <main class='about'>
      <Title>About</Title>
      <h1>About duckchess.org</h1>
      <p>Duck chess is a variant of chess that has a duck as a brick you have to place after each move.</p>
      <p>For more information about how to play duck chess please visit <a href='https://duckchess.com'>duckchess.com</a></p>
      <p>Thanks to <a href='https://lichess.org'>lichess.org</a> for reference.</p>
      <p>Please also visit my other website <a href='https://aidchess.com'>aidchess.com</a></p>
    </main>
  );
}
