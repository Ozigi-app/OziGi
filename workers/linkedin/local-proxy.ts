/**
 * Local HTTP CONNECT proxy → upstream proxy HTTP proxy (auth sent upfront).
 */
import http from 'http'
import net from 'net'

let server: http.Server | null = null
let localPort: number | null = null

export async function startLocalProxy(
  proxyHost: string,
  proxyPort: number,
  username: string,
  password: string,
): Promise<number> {
  if (localPort !== null) return localPort

  server = http.createServer((_req, res) => {
    res.writeHead(405); res.end()
  })

  server.on('connection', socket => {
    console.log(`[local-proxy] chromium connected from ${socket.remoteAddress}:${socket.remotePort}`)
  })

  server.on('connect', (req, clientSocket, head) => {
    const target = req.url ?? 'unknown'
    console.log(`[local-proxy] CONNECT ${target}`)

    const [targetHost, portStr] = target.split(':')
    const targetPort = parseInt(portStr, 10) || 443
    const auth = Buffer.from(`${username}:${password}`).toString('base64')

    const proxySocket = net.connect(proxyPort, proxyHost, () => {
      console.log(`[local-proxy] connected to upstream proxy, sending CONNECT for ${target}`)
      proxySocket.write(
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
        `Host: ${targetHost}:${targetPort}\r\n` +
        `Proxy-Authorization: Basic ${auth}\r\n` +
        `\r\n`
      )
    })

    proxySocket.on('error', err => {
      console.error(`[local-proxy] upstream proxy socket error for ${target} — ${err.message}`)
      try { clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n') } catch {}
      clientSocket.destroy()
    })

    clientSocket.on('error', err => {
      console.error(`[local-proxy] chromium socket error for ${target} — ${err.message}`)
      proxySocket.destroy()
    })

    let headerBuf = ''
    const onData = (chunk: Buffer) => {
      headerBuf += chunk.toString('binary')
      const sep = headerBuf.indexOf('\r\n\r\n')
      if (sep === -1) return

      proxySocket.removeListener('data', onData)

      const statusLine = headerBuf.slice(0, headerBuf.indexOf('\r\n'))
      const remainder  = Buffer.from(headerBuf.slice(sep + 4), 'binary')

      console.log(`[local-proxy] upstream proxy response for ${target}: ${statusLine}`)

      if (statusLine.includes('200')) {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head?.length)     proxySocket.write(head)
        if (remainder.length) clientSocket.write(remainder)

        proxySocket.pipe(clientSocket)
        clientSocket.pipe(proxySocket)

        proxySocket.on('error', err => console.error(`[local-proxy] pipe proxySocket error — ${err.message}`))
        clientSocket.on('error', err => console.error(`[local-proxy] pipe clientSocket error — ${err.message}`))

        console.log(`[local-proxy] tunnel established for ${target}`)
      } else {
        console.error(`[local-proxy] upstream proxy rejected ${target}: ${statusLine}`)
        try { clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n') } catch {}
        clientSocket.destroy()
        proxySocket.destroy()
      }
    }

    proxySocket.on('data', onData)
  })

  return new Promise((resolve, reject) => {
    server!.listen(0, '127.0.0.1', () => {
      localPort = (server!.address() as net.AddressInfo).port
      console.log(`[local-proxy] ready on 127.0.0.1:${localPort} → http://${proxyHost}:${proxyPort}`)
      resolve(localPort)
    })
    server!.on('error', reject)
  })
}
