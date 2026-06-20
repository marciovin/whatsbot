import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import http from 'http'
import qrcode from 'qrcode'
import 'dotenv/config'

import { handleMessage } from './handlers/messageHandler.js'

const logger = pino({ level: 'silent' })

let conectado = false
let qrAtual = null

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessions')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: jid => isJidBroadcast(jid),
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrAtual = qr
      console.log('\n📱 Novo QR Code gerado — acesse a página web para escanear\n')
    }

    if (connection === 'close') {
      conectado = false
      const codigoErro = new Boom(lastDisconnect?.error)?.output?.statusCode
      const motivo = DisconnectReason

      if (codigoErro === motivo.loggedOut) {
        console.log('\n❌ Sessão encerrada. Apague a pasta ./sessions para reconectar.')
      } else {
        console.log('\n🔄 Reconectando...')
        conectar()
      }
    }

    if (connection === 'open') {
      conectado = true
      qrAtual = null
      const numero = sock.user?.id?.split(':')[0]
      console.log('━'.repeat(50))
      console.log(`  ✅ Bot conectado!`)
      console.log(`  📞 Número: +${numero}`)
      console.log(`  🤖 Nome: ${process.env.BOT_NAME ?? 'WhatsBot'}`)
      console.log('━'.repeat(50) + '\n')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      if (msg.key.remoteJid === 'status@broadcast') continue
      await handleMessage(sock, msg)
    }
  })

  return sock
}

// ─── Servidor HTTP: mostra o QR code numa página ────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    if (conectado) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#075E54;color:white;text-align:center;">
          <div>
            <h1>✅ WhatsApp conectado!</h1>
            <p>O bot já está funcionando.</p>
          </div>
        </body></html>
      `)
      return
    }

    if (!qrAtual) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#075E54;color:white;text-align:center;">
          <div>
            <h1>⏳ Gerando QR Code...</h1>
            <p>Atualize a página em alguns segundos.</p>
            <script>setTimeout(() => location.reload(), 3000)</script>
          </div>
        </body></html>
      `)
      return
    }

    const qrImagem = await qrcode.toDataURL(qrAtual, { width: 320 })

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#075E54;color:white;text-align:center;padding:20px;">
        <h1>📱 Escaneie para conectar</h1>
        <img src="${qrImagem}" style="border-radius:12px;margin:20px 0;" />
        <p style="max-width:320px;line-height:1.6;">
          WhatsApp → ⋮ menu → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong>
        </p>
        <script>setTimeout(() => location.reload(), 20000)</script>
      </body>
      </html>
    `)
    return
  }

  res.writeHead(404)
  res.end()
})

const PORTA = process.env.PORT || 3000
server.listen(PORTA, () => {
  console.log(`🌐 Página de QR Code: http://localhost:${PORTA}\n`)
})

console.log('\n🚀 Iniciando WhatsBot...\n')
conectar()