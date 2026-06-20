import { extrairTexto } from '../utils/mensagem.js'
import { ping } from '../commands/ping.js'
import { ajuda } from '../commands/ajuda.js'
import { saudacao } from '../commands/saudacao.js'
import { processarFluxo } from '../fluxo/pedido.js'
import { getEstado } from '../fluxo/estado.js'

// Registra os comandos aqui: { nome: função }
const COMANDOS = {
  ping,
  ajuda,
  help: ajuda,
}

const PREFIX = process.env.PREFIX ?? '!'

export async function handleMessage(sock, msg) {
  try {
    const texto = extrairTexto(msg)
    if (!texto) return

    const jid = msg.key.remoteJid
    const isGrupo = jid.endsWith('@g.us')

    // Grupos: só responde comandos, sem fluxo de pedido
    if (isGrupo) {
      if (!texto.startsWith(PREFIX)) return
      const [cmdRaw, ...args] = texto.slice(PREFIX.length).trim().split(/\s+/)
      const cmd = cmdRaw.toLowerCase()
      const handler = COMANDOS[cmd]
      if (handler) await handler({ sock, msg, jid, args, isGrupo })
      return
    }

    // ─── PV ───────────────────────────────────────────────────

    // 1. Se tem fluxo ativo, processa a resposta do cliente
    if (getEstado(jid)) {
      const tratado = await processarFluxo({ sock, jid, msg, texto })
      if (tratado) return
    }

    // 2. Comandos com prefixo
    if (texto.startsWith(PREFIX)) {
      const [cmdRaw, ...args] = texto.slice(PREFIX.length).trim().split(/\s+/)
      const cmd = cmdRaw.toLowerCase()
      const handler = COMANDOS[cmd]
      if (handler) {
        console.log(`💬 Comando: ${PREFIX}${cmd} | Args: ${args.join(' ')}`)
        await handler({ sock, msg, jid, args, isGrupo })
      }
      return
    }

    // 3. Qualquer outra mensagem → saudação + inicia pedido
    await saudacao({ sock, msg, jid })

  } catch (err) {
    console.error('❌ Erro no handleMessage:', err)
  }
}
