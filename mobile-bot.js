// Lightweight Messenger Bot for Mobile/Termux
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const { PAGE_ACCESS_TOKEN, VERIFY_TOKEN } = process.env;

// Simple in-memory conversation store
const conversations = new Map();

// Health check
app.get('/', (req, res) => {
  res.json({  
    status: '🤖 Mobile Bot Running',  
    platform: 'Android/Termux',
    uptime: process.uptime()
  });
});

// Facebook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log('✅ Verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages
app.post('/webhook', async (req, res) => {
  res.status(200).send('OK');
  
  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry) {
    for (const event of entry.messaging) {

      // 👋 WELCOME MESSAGE
      if (event.postback && event.postback.payload === "GET_STARTED") {
        await sendText(event.sender.id, "👋 Welcome to Nang AI Bot!\n\nType 'help' to see commands.");
        continue;
      }

      if (event.message?.text) {
        await handleMessage(event.sender.id, event.message.text);
      }
    }
  }
});

// 👀 HANDLE MESSAGE
async function handleMessage(senderId, text) {
  await sendAPI(senderId, { sender_action: "typing_on" });

  const msg = text.toLowerCase().trim(); // ✅ FIXED (was missing)

  // 📖 HELP COMMAND
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

  // 📌 MENU COMMAND
  if (msg === "menu") {
    return sendText(senderId,
`📌 Menu:

🤖 AI Chat
📖 Help

Type anything to chat`
    );
  }

  // 🤖 AI COMMAND
  if (msg.startsWith("ai ")) {
    const question = text.slice(3);
    const reply = await getAIReply([{ role: 'user', content: question }]);
    return sendText(senderId, reply);
  }

  // 💬 DEFAULT (AI CHAT WITH MEMORY)
  const history = conversations.get(senderId) || [];
  history.push({ role: 'user', content: text });

  const reply = await getAIReply(history);
  history.push({ role: 'assistant', content: reply });

  conversations.set(senderId, history.slice(-10));

  await sendText(senderId, reply);
  console.log(`📤 Reply sent`);
}

// 🤖 AI REQUEST
async function getAIReply(history) {
  const keys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
  ].filter(Boolean);

  for (let i = 0; i < keys.length; i++) {
    try {
      console.log(`🔑 Trying API Key ${i + 1}...`);

      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "Always reply in the same language as the user."
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

      return response.data.choices[0].message.content;

    } catch (err) {
      console.log("❌ Key failed, trying next...");
    }
  }

  return "⚠️ Nang AI Have a problem, comeback later.";
}

// 📤 SEND TEXT
async function sendText(recipientId, text) {
  return sendAPI(recipientId, {
    message: { text: text.substring(0, 2000) }
  });
}

// 📡 SEND API
async function sendAPI(recipientId, payload) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: recipientId }, ...payload }
    );
  } catch (err) {
    console.error('Send failed:', err.response?.data?.error?.message || err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
📱 Mobile Bot Running!

Local: http://localhost:${PORT}
`);
});
