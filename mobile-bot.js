const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const { PAGE_ACCESS_TOKEN, VERIFY_TOKEN } = process.env;

// Memory
const conversations = new Map();

// Health check
app.get('/', (req, res) => {
  res.json({
    status: '🤖 Nang AI Running',
    uptime: process.uptime()
  });
});

// VERIFY
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// RECEIVE
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry) {
    for (const event of entry.messaging) {

      // 👋 WELCOME
      if (event.postback?.payload === "GET_STARTED") {
        await sendText(event.sender.id,
`👋 Welcome to Nang AI Bot!

Type:
help - commands
menu - options
ai <question> - ask AI`
        );
        continue;
      }

      if (event.message?.text) {
        await handleMessage(event.sender.id, event.message.text);
      }
    }
  }
});

// HANDLE MESSAGE
async function handleMessage(senderId, text) {
  await sendAPI(senderId, { sender_action: "typing_on" });

  const msg = text.toLowerCase().trim();

  // HELP
  if (msg === "help") {
    return sendText(senderId,
`📖 Commands:

help - show this
menu - show menu
ai <question> - ask AI

Example:
ai what is earth?`
    );
  }

  // MENU
  if (msg === "menu") {
    return sendText(senderId,
`📌 Menu:

🤖 AI Chat
📖 Help

Type anything to chat`
    );
  }

  // AI COMMAND
  if (msg.startsWith("ai ")) {
    const question = text.slice(3);
    const reply = await getAIReply([{ role: "user", content: question }]);
    return sendText(senderId, reply);
  }

  // DEFAULT CHAT (MEMORY)
  const history = conversations.get(senderId) || [];
  history.push({ role: "user", content: text });

  const reply = await getAIReply(history);
  history.push({ role: "assistant", content: reply });

  conversations.set(senderId, history.slice(-10));

  await sendText(senderId, reply);
}

// AI FUNCTION
async function getAIReply(history) {
  const keys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
  ].filter(Boolean);

  for (let i = 0; i < keys.length; i++) {
    try {
      console.log("🔑 Using key " + (i + 1));

      const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "Reply same language as user."
            },
            ...history
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${keys[i]}`,
            "Content-Type": "application/json"
          }
        }
      );

      return res.data.choices[0].message.content;

    } catch (err) {
      console.log("❌ Key failed");
    }
  }

  return "⚠️ Nang AI Have a problem, comeback later.";
}

// SEND TEXT
async function sendText(id, text) {
  return sendAPI(id, {
    message: { text: text.substring(0, 2000) }
  });
}

// SEND API
async function sendAPI(id, payload) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id },
        ...payload
      }
    );
  } catch (err) {
    console.log("Send error:", err.response?.data || err.message);
  }
}

// START SERVER (IMPORTANT — DO NOT DELETE)
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log("🚀 Nang AI Bot Running on port " + PORT);
});
