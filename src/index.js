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
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

import { handleMessage } from './handlers/messageHandler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logger = pino({ level: 'silent' })

// ─── Estado global da conexão ──────────────────────────────────
let sockAtual = null
let conectado = false
let ultimoCodigoGerado = null
let gerandoCodigo = false
// Número pendente de pareamento — fica guardado entre reconexões
// até o handshake terminar (connection === 'open')
let numeroPendente = null
let fechandoManualmente = false

// ─── Conecta (ou reconecta) ao WhatsApp ────────────────────────
async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessions')
  const { version } = await fetchLatestBaileysVersion()

  const jaRegistrado = !!state.creds?.registered

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false, // usamos código de pareamento, não QR
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: jid => isJidBroadcast(jid),
  })

  sockAtual = sock

  // Só pede o código na PRIMEIRA tentativa (ainda não registrado).
  // Nas reconexões seguintes do mesmo processo de pareamento,
  // as credenciais parciais já salvas continuam o handshake sem
  // precisar (e sem poder) gerar outro código.
  if (numeroPendente && !jaRegistrado) {
    try {
      gerandoCodigo = true
      ultimoCodigoGerado = null
      await new Promise(r => setTimeout(r, 1500)) // espera o socket inicializar
      const codigo = await sock.requestPairingCode(numeroPendente)
      console.log(`\n🔑 Código de pareamento: ${codigo}\n`)
      ultimoCodigoGerado = codigo
    } catch (err) {
      console.error('❌ Erro ao gerar código de pareamento:', err)
      ultimoCodigoGerado = null
      numeroPendente = null
    } finally {
      gerandoCodigo = false
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

   if (connection === 'close') {
      conectado = false

      // Esse close foi causado por nós mesmos (sock.end() manual antes
      // de pedir um pareamento novo) — não reconecta aqui, quem está
      // chamando conectar() já vai cuidar disso.
      if (fechandoManualmente) {
        fechandoManualmente = false
        return
      }

      const codigoErro = new Boom(lastDisconnect?.error)?.output?.statusCode
      const motivo = DisconnectReason

      if (codigoErro === motivo.loggedOut) {
        console.log('\n❌ Sessão encerrada. Apague a pasta ./sessions para reconectar.')
        numeroPendente = null
      } else {
        console.log('\n🔄 Reconectando...')
        setTimeout(() => conectar(), 1000)
      }
    }

    if (connection === 'open') {
      conectado = true
      numeroPendente = null
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

// ─── Servidor HTTP: serve a página + API de pareamento ─────────
const server = http.createServer(async (req, res) => {
  // Página principal
  if (req.method === 'GET' && req.url === '/') {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf-8')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  // API: gerar código de pareamento
  if (req.method === 'POST' && req.url === '/api/conectar') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { numero } = JSON.parse(body)
        const numeroLimpo = String(numero).replace(/\D/g, '')

        if (!numeroLimpo || numeroLimpo.length < 10) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ erro: 'Número inválido. Use o formato DDI+DDD+número.' }))
          return
        }

        if (conectado) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ jaConectado: true }))
          return
        }

        if (gerandoCodigo) {
          res.writeHead(429, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ erro: 'Já existe uma solicitação em andamento. Aguarde.' }))
          return
        }

          numeroPendente = numeroLimpo

        // Fecha o socket atual antes de iniciar um pareamento novo,
        // pra não acumular conexões abertas. Marca a flag pra
        // ignorar a reconexão automática desse close específico.
        fechandoManualmente = true
        try { sockAtual?.end?.(undefined) } catch {}
        await new Promise(r => setTimeout(r, 300))
        await conectar()

        // Espera o código ser gerado (até 15s)
        let tentativas = 0
        while (gerandoCodigo && tentativas < 30) {
          await new Promise(r => setTimeout(r, 500))
          tentativas++
        }

        if (!ultimoCodigoGerado) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ erro: 'Não foi possível gerar o código. Tente novamente.' }))
          return
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ codigo: ultimoCodigoGerado }))

      } catch (err) {
        console.error('❌ Erro na API de conectar:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ erro: 'Erro interno. Tente novamente.' }))
      }
    })
    return
  }

  // Status simples (útil pra debug)
  if (req.method === 'GET' && req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ conectado }))
    return
  }

  res.writeHead(404)
  res.end()
})

const PORTA = process.env.PORT || 3000
server.listen(PORTA, () => {
  console.log(`🌐 Página de conexão: http://localhost:${PORTA}\n`)
})

// ─── Boot ────────────────────────────────────────────────────
console.log('\n🚀 Iniciando WhatsBot...\n')
conectar()
