/**
 * Guarda o estado do pedido de cada cliente em memória.
 * Chave: jid (número do WhatsApp)
 * Valor: { etapa, dados }
 *
 * Etapas possíveis:
 *  'marmitex'  → aguardando escolha do tamanho
 *  'endereco'  → aguardando o endereço
 *  'confirmado' → pedido finalizado
 */

const estados = new Map()

export function getEstado(jid) {
  return estados.get(jid) ?? null
}

export function setEstado(jid, etapa, dados = {}) {
  const atual = estados.get(jid) ?? {}
  estados.set(jid, { etapa, dados: { ...atual.dados, ...dados } })
}

export function limparEstado(jid) {
  estados.delete(jid)
}
