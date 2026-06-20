import { getEstado, setEstado, limparEstado } from './estado.js'

const OWNER = process.env.OWNER_NUMBER
  ? `${process.env.OWNER_NUMBER}@s.whatsapp.net`
  : null

const PIX_KEY = process.env.PIX_KEY ?? 'e474741f-5351-4592-8549-6bab0d00ed92'

// ─── Inicia o fluxo ────────────────────────────────────────────
export async function iniciarPedido({ sock, jid, msg }) {
  setEstado(jid, 'marmitex')

  await sock.sendMessage(jid, {
    text:
      `🍱 Qual o tamanho da marmitex?\n\n` +
      `*20* — Marmitex P (R$ 20,00)\n` +
      `*25* — Marmitex G (R$ 25,00)\n\n` +
      `_Digite 20 ou 25 para escolher._`,
  }, { quoted: msg })
}

// ─── Processa a resposta de acordo com a etapa atual ───────────
export async function processarFluxo({ sock, jid, msg, texto }) {
  const estado = getEstado(jid)
  if (!estado) return false

  const resposta = texto.trim()

  // ETAPA 1 — escolha do marmitex
  if (estado.etapa === 'marmitex') {
    if (resposta !== '20' && resposta !== '25') {
      await sock.sendMessage(jid, {
        text: '❓ Por favor, digite *20* ou *25* para escolher o tamanho.',
      }, { quoted: msg })
      return true
    }

    const tamanho = resposta === '20' ? 'P (R$ 20,00)' : 'G (R$ 25,00)'
    setEstado(jid, 'observacao', { marmitex: tamanho })

    await sock.sendMessage(jid, {
      text:
        `✅ Marmitex *${tamanho}* selecionada!\n\n` +
        `📝 Há alguma observação? _(ex: sem feijão, sem cebola)_\n\n` +
        `_Se não houver, responda *não*._`,
    }, { quoted: msg })

    return true
  }

  // ETAPA 2 — observação
  if (estado.etapa === 'observacao') {
    const obs = ['nao', 'não', 'n', 'nenhuma', 'sem observacao', 'sem observação'].includes(
      resposta.toLowerCase()
    ) ? null : resposta

    setEstado(jid, 'endereco', { observacao: obs })

    await sock.sendMessage(jid, {
      text:
        `📍 Agora me informe seu *endereço completo* para entrega:\n` +
        `_Rua, número, bairro e complemento (se houver)._`,
    }, { quoted: msg })

    return true
  }

  // ETAPA 3 — endereço
  if (estado.etapa === 'endereco') {
    if (resposta.length < 10) {
      await sock.sendMessage(jid, {
        text: '📍 Endereço muito curto. Pode informar rua, número e bairro?',
      }, { quoted: msg })
      return true
    }

    setEstado(jid, 'finalizado', { endereco: resposta })
    const dados = getEstado(jid).dados

    // Mensagem 1: resumo do pedido
    await sock.sendMessage(jid, {
      text:
        `✅ *Pedido recebido!*\n\n` +
        `🍱 Marmitex: *${dados.marmitex}*\n` +
        (dados.observacao ? `📝 Obs: ${dados.observacao}\n` : '') +
        `📍 Endereço: ${dados.endereco}\n\n` +
        `💳 Pague via Pix para confirmar:`,
    }, { quoted: msg })

    // Mensagem 2: só a chave Pix, separada e fácil de copiar
    await sock.sendMessage(jid, {
      text: PIX_KEY,
    })

    // Mensagem 3: instrução final
    await sock.sendMessage(jid, {
      text: `_Após o pagamento, envie o comprovante aqui. Em breve confirmaremos seu pedido!_ 🙏`,
    })

    // Notifica o dono
    if (OWNER) {
      await sock.sendMessage(OWNER, {
        text:
          `🔔 *Novo pedido recebido!*\n\n` +
          `📞 Cliente: wa.me/${jid.split('@')[0]}\n` +
          `🍱 Marmitex: ${dados.marmitex}\n` +
          (dados.observacao ? `📝 Obs: ${dados.observacao}\n` : '') +
          `📍 Endereço: ${dados.endereco}\n\n` +
          `⏳ Aguardando comprovante Pix.`,
      })
    }

    setTimeout(() => limparEstado(jid), 5 * 60 * 1000)

    return true
  }

  return false
}