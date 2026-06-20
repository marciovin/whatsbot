import { getEstado, setEstado, limparEstado } from './estado.js'

const OWNER = process.env.OWNER_NUMBER
  ? `${process.env.OWNER_NUMBER}@s.whatsapp.net`
  : null

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
  if (!estado) return false // sem fluxo ativo, ignora

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
    setEstado(jid, 'endereco', { marmitex: tamanho })

    await sock.sendMessage(jid, {
      text:
        `✅ Marmitex *${tamanho}* selecionada!\n\n` +
        `📍 Agora me informe seu *endereço completo* para entrega:\n` +
        `_Rua, número, bairro e complemento (se houver)._`,
    }, { quoted: msg })

    return true
  }

  // ETAPA 2 — endereço
  if (estado.etapa === 'endereco') {
    if (resposta.length < 10) {
      await sock.sendMessage(jid, {
        text: '📍 Endereço muito curto. Pode informar rua, número e bairro?',
      }, { quoted: msg })
      return true
    }

    setEstado(jid, 'confirmado', { endereco: resposta })
    const dados = getEstado(jid).dados

    const resumo =
      `✅ *Pedido recebido!*\n\n` +
      `🍱 Marmitex: *${dados.marmitex}*\n` +
      `📍 Endereço: ${dados.endereco}\n\n` +
      `Em breve entraremos em contato para confirmar. 😊`

    await sock.sendMessage(jid, { text: resumo }, { quoted: msg })

    // Notifica o dono se configurado no .env
    if (OWNER) {
      await sock.sendMessage(OWNER, {
        text:
          `🔔 *Novo pedido recebido!*\n\n` +
          `📞 Cliente: wa.me/${jid.split('@')[0]}\n` +
          `🍱 Marmitex: ${dados.marmitex}\n` +
          `📍 Endereço: ${dados.endereco}`,
      })
    }

    // Limpa o estado após 5 min (permite novo pedido)
    setTimeout(() => limparEstado(jid), 5 * 60 * 1000)

    return true
  }

  return false
}
