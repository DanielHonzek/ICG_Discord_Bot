const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');

let lastPingTime = "Zatím žádný ping nepřišel";

const firebaseKey = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(firebaseKey)
});
const db = admin.firestore();

const app = express();
app.get('/', (req, res) => {
  lastPingTime = new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
  res.send('Bot i databáze běží! Poslední ping: ' + lastPingTime);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Web server běží na portu ' + (process.env.PORT || 3000));
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commands = [
  new SlashCommandBuilder().setName('testbot').setDescription('Zkontroluje, zda bot běží'),
  new SlashCommandBuilder().setName('testdb').setDescription('Zkontroluje připojení k databázi'),
  new SlashCommandBuilder().setName('testur').setDescription('Zkontroluje poslední aktivitu UptimeRobota'),
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`Bot je online jako ${client.user.tag}!`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash příkazy byly úspěšně zaregistrovány.');
  } catch (error) {
    console.error(error);
  }

  setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_HOSTNAME 
      ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` 
      : "https://icg-discord-bot.onrender.com";

    axios.get(url)
      .then(() => console.log('Self-ping úspěšný.'))
      .catch(err => console.error('Self-ping selhal:', err.message));
  }, 1000 * 60 * 5);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'testbot') {
    await interaction.reply('✅ Bot je online, reaguje a běží na Renderu!');
  }

  if (interaction.commandName === 'testur') {
    await interaction.reply(`🌐 **Uptime Check:**\nPoslední požadavek na webový server přišel v: \`${lastPingTime}\`.\n*(Pokud je čas aktuální, UptimeRobot i Self-ping fungují správně.)*`);
  }

  if (interaction.commandName === 'testdb') {
    await interaction.deferReply();
    try {
      const testRef = db.collection('status_checks').doc('last_check');
      await testRef.set({
        last_online: admin.firestore.FieldValue.serverTimestamp(),
        status: 'OK'
      });
      await interaction.editReply('✅ Databáze Firebase je připojena a zápis proběhl v pořádku!');
    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Chyba při připojení k databázi: ' + error.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
