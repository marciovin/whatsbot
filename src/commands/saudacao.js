import { iniciarPedido } from '../fluxo/pedido.js'

export async function saudacao({ sock, msg, jid }) {
  const hora = new Date().getHours()

  let periodo
  if (hora >= 5 && hora < 12) {
    periodo = 'bom dia'
  } else if (hora >= 12 && hora < 18) {
    periodo = 'boa tarde'
  } else {
    periodo = 'boa noite'
  }

  await sock.sendMessage(jid, {
    text: `Oi! ${periodo} 😊 Seja bem-vindo(a)!`,
  }, { quoted: msg })

  // Já inicia o fluxo do pedido logo em seguida
  await iniciarPedido({ sock, jid, msg })
}
