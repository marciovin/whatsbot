# 🤖 WhatsBot — Baileys + Node.js

Bot para WhatsApp usando **@whiskeysockets/baileys** (sem browser/Puppeteer).

---

## 📦 Instalação

```bash
# 1. Instale as dependências
npm install

# 2. Configure o .env
cp .env.example .env
# edite o .env com seu número e preferências

# 3. Inicie o bot
npm start
```

Na primeira vez aparece um **QR Code no terminal** — escaneie com o WhatsApp:
> WhatsApp → ⋮ menu → Aparelhos conectados → Conectar aparelho

As credenciais ficam salvas em `./sessions/`. Da próxima vez o bot conecta automático.

---

## 📁 Estrutura

```
whatsbot/
├── src/
│   ├── index.js                  ← entrada, conexão, QR
│   ├── handlers/
│   │   └── messageHandler.js     ← roteador de comandos
│   ├── commands/
│   │   ├── ping.js
│   │   └── ajuda.js
│   └── utils/
│       └── mensagem.js           ← helpers de mensagem
├── sessions/                     ← credenciais salvas (ignorado pelo git)
├── .env.example
└── package.json
```

---

## ➕ Adicionando um novo comando

1. Crie `src/commands/meucomando.js`:

```js
export async function meucomando({ sock, jid, msg, args }) {
  await sock.sendMessage(jid, { text: `Você disse: ${args.join(' ')}` }, { quoted: msg })
}
```

2. Registre em `src/handlers/messageHandler.js`:

```js
import { meucomando } from '../commands/meucomando.js'

const COMANDOS = {
  ping,
  ajuda,
  meucomando, // ← adiciona aqui
}
```

Pronto! O bot já responde `!meucomando`.

---

## 🔧 Variáveis de ambiente (`.env`)

| Variável | Descrição | Padrão |
|---|---|---|
| `BOT_NAME` | Nome do bot | `MeuBot` |
| `PREFIX` | Prefixo dos comandos | `!` |
| `OWNER_NUMBER` | Seu número (DDI+DDD+número) | — |

---

## ⚠️ Resetar sessão

Se der problema de autenticação, delete a pasta `sessions/` e escaneie o QR de novo:

```bash
rm -rf sessions/
npm start
```
