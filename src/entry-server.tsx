// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

import { ws } from '~/ws'
import type { IncomingMessage } from 'node:http'

const emptyBuffer = Buffer.from('')
const handleUpgrade = (request: IncomingMessage) =>
  ws.handleUpgrade(request, request.socket, emptyBuffer)

export { handleUpgrade }

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="stylesheet" href="/merida.css" />
          <link rel="stylesheet" href="/duck.css" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
