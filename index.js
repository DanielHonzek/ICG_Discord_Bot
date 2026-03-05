const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const admin = require('firebase-admin');
const express = require('express');

const firebaseKey = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({ credential: admin.credential.cert(firebaseKey) });
const db = admin.firestore();

const app = express();
app.get('/', (req, res) => res.send('Bot běží!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

require('./logs.js')(client, db);
require('./moderation.js')(client, db);
require('./ticketsystem.js')(client, db);

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} je připraven!`);
});

client.login(process.env.DISCORD_TOKEN);
