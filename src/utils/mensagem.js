/**
 * Extrai o texto de uma mensagem, independente do tipo
 * (texto simples, legenda de imagem/vídeo, lista, botão, etc.)
 */
export function extrairTexto(msg) {
  const m = msg.message

  if (!m) return null

  return (
    m.conversation ||                           // mensagem de texto normal
    m.extendedTextMessage?.text ||              // texto com link/menção
    m.imageMessage?.caption ||                  // legenda de imagem
    m.videoMessage?.caption ||                  // legenda de vídeo
    m.documentMessage?.caption ||               // legenda de documento
    m.buttonsResponseMessage?.selectedDisplayText || // resposta de botão
    m.listResponseMessage?.title ||             // resposta de lista
    null
  )
}

/**
 * Retorna o número limpo do remetente (sem @s.whatsapp.net)
 */
export function extrairNumero(msg) {
  return msg.key.remoteJid?.split('@')[0] ?? null
}

/**
 * Monta o JID de um número (adiciona @s.whatsapp.net se não tiver)
 */
export function paraJID(numero) {
  if (numero.includes('@')) return numero
  return `${numero}@s.whatsapp.net`
}
