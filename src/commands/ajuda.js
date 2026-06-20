const PREFIX = process.env.PREFIX ?? '!'
const BOT_NAME = process.env.BOT_NAME ?? 'WhatsBot'

export async function ajuda({ sock, jid, msg }) {
  const texto = `🤖 *${BOT_NAME}*

*Comandos disponíveis:*

${PREFIX}ping — Testa se o bot está online
${PREFIX}ajuda — Mostra esta mensagem

━━━━━━━━━━━━━━━━
_Prefixo atual: \`${PREFIX}\`_`

  await sock.sendMessage(jid, { text: texto }, { quoted: msg })
}
