const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = (client, db) => {
    const CHANNEL_ID = '1459073205380841482';

    client.once('ready', async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) return console.error("❌ Kanál pro tickety nebyl nalezen!");

        try {
            const fetched = await channel.messages.fetch({ limit: 10 });
            await channel.bulkDelete(fetched);
        } catch (err) {
            console.log("Nepodařilo se smazat zprávy (pravděpodobně jsou starší než 14 dní).");
        }

        const embed = new EmbedBuilder()
            .setTitle('Podpora serveru')
            .setDescription('Potřebuješ pomoc? Klikni na tlačítko níže a otevři si ticket. Naši moderátoři se ti budou brzy věnovat.')
            .setColor('#5865F2')
            .setFooter({ text: 'Ticket System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Otevřít Ticket')
                .setEmoji('📩')
                .setStyle(ButtonStyle.Primary)
        );

        await channel.send({ embeds: [embed], components: [row] });
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'open_ticket') {
            await interaction.deferReply({ ephemeral: true });

            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                ],
            });

            await ticketChannel.send(`Ahoj ${interaction.user}, administrátoři tu budou co nevidět.`);
            await interaction.editReply({ content: `Tvůj ticket byl vytvořen: ${ticketChannel}` });
        }
    });
};
