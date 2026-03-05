const { SlashCommandBuilder } = require('discord.js');

module.exports = (client, db) => {
    
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'kick') {
            await interaction.reply('Uživatel byl vyhozen (test).');
        }
    });

    client.on('guildMemberAdd', (member) => {
        console.log(`Nový člen pro moderaci: ${member.user.tag}`);
    });
};
