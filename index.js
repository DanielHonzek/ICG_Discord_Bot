const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot bezi!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => console.log('Bot je online!'));

client.on('messageCreate', m => {
  if (m.content === '!ping') m.reply('Pong! Funguju z Renderu.');
});

client.login(process.env.DISCORD_TOKEN);
