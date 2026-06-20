export async function ping({ sock, jid, msg }) {
  const inicio = Date.now()

  await sock.sendMessage(jid, { text: '🏓 Pong!' }, { quoted: msg })

  const latencia = Date.now() - inicio
  console.log(`⚡ Ping respondido em ${latencia}ms`)
}
