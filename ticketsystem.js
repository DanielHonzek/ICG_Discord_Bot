const { 
    EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle 
} = require('discord.js');

module.exports = (client, db) => {
    const CHANNEL_ID = '1459073205380841482';
    const STAFF_PING_ROLE = '1459169084787921019';
    
    const AUTHORIZED_ROLES = [
        '1459070165164757225',
        '1466864975133016280',
        '1467512663306404087',
        '1459168937752137842'
    ];

    client.once('ready', async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) return console.error("❌ Kanál pro tickety nebyl nalezen!");

        try {
            const fetched = await channel.messages.fetch({ limit: 10 });
            await channel.bulkDelete(fetched);
        } catch (err) { console.log("Čištění kanálu nebylo možné."); }

        const mainEmbed = new EmbedBuilder()
            .setTitle('Podpora serveru')
            .setDescription('Vyberte si kategorii z menu níže pro otevření ticketu.')
            .setColor('#5865F2');

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Vyberte kategorii ticketu...')
                .addOptions([
                    { label: 'Všeobecná podpora', value: 'gen_support', emoji: '💬' },
                    { label: 'Technická Podpora', value: 'tech_support', emoji: '⚙️' },
                    { label: 'AntiCheat', value: 'anticheat', emoji: '🛡️' },
                    { label: 'Žádost o zrušení trestu', value: 'unban_req', emoji: '⚖️' },
                    { label: 'Nahlášení hráče/uživatele', value: 'report_player', emoji: '👤' },
                    { label: 'Nahlášení člena A-Teamu', value: 'report_staff', emoji: '🚨' },
                ])
        );

        await channel.send({ embeds: [mainEmbed], components: [selectMenu] });
    });

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            const modal = new ModalBuilder().setCustomId(`modal_${interaction.values[0]}`);

            if (interaction.values[0] === 'gen_support') {
                modal.setTitle('Všeobecná podpora');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('q1').setLabel('S čím vám můžeme pomoct?').setStyle(TextInputStyle.Paragraph).setMaxLength(1000)
                ));
            } else if (interaction.values[0] === 'tech_support') {
                modal.setTitle('Technická Podpora');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('q1').setLabel('O jaký technický problém se jedná?').setStyle(TextInputStyle.Paragraph).setMaxLength(1000)
                ));
            } else if (interaction.values[0] === 'anticheat') {
                modal.setTitle('AntiCheat');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('q1').setLabel('Co byste rádi řešili?').setStyle(TextInputStyle.Paragraph).setMaxLength(1000)
                ));
            } else if (interaction.values[0] === 'unban_req') {
                modal.setTitle('Žádost o zrušení trestu');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Uživatelské jméno').setStyle(TextInputStyle.Short).setMaxLength(100)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Jaký trest jste dostal?').setStyle(TextInputStyle.Short).setMaxLength(100)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Důvod trestu').setStyle(TextInputStyle.Paragraph).setMaxLength(1000)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Kdy jste trest obdržel?').setStyle(TextInputStyle.Short).setMaxLength(100)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q5').setLabel('Proč žádost vyhovět?').setStyle(TextInputStyle.Paragraph).setMaxLength(1000))
                );
            } else if (interaction.values[0] === 'report_player') {
                modal.setTitle('Nahlášení hráče');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Username hráče').setStyle(TextInputStyle.Short).setMaxLength(100)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Důvod nahlášení').setStyle(TextInputStyle.Paragraph).setMaxLength(1000))
                );
            } else if (interaction.values[0] === 'report_staff') {
                modal.setTitle('Nahlášení člena A-Teamu');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Username člena').setStyle(TextInputStyle.Short).setMaxLength(100)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Důvod nahlášení').setStyle(TextInputStyle.Paragraph).setMaxLength(1000))
                );
            }

            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });
            const type = interaction.customId.replace('modal_', '');
            
            const permissionOverwrites = [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
            ];
            AUTHORIZED_ROLES.forEach(roleId => {
                permissionOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            });

            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: permissionOverwrites
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Úspěšně jste vytvořil ticket (${type})`)
                .setDescription(`Naš Discord Staff Team se vám bude věnovat hned jak to bude možné. Děkujeme za vaší trpělivost.`)
                .setColor('#00FF00');

            const infoEmbed = new EmbedBuilder().setTitle('Informace').setColor('#5865F2');
            interaction.fields.fields.forEach(field => {
                infoEmbed.addFields({ name: field.customId.replace('q', 'Otázka č. '), value: `\`\`\`${field.value}\`\`\`` });
            });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Uzavřít').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Převzít').setStyle(ButtonStyle.Success)
            );

            await ticketChannel.send({ 
                content: `${interaction.user} | <@&${STAFF_PING_ROLE}>`, 
                embeds: [welcomeEmbed, infoEmbed], 
                components: [buttons] 
            });

            await interaction.editReply(`Ticket vytvořen: ${ticketChannel}`);
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'claim_ticket') {
                if (!AUTHORIZED_ROLES.some(id => interaction.member.roles.cache.has(id))) {
                    return interaction.reply({ content: 'Tuto akci mohou provádět pouze členové Staffu!', ephemeral: true });
                }
                await interaction.reply({ content: `Ticket převzal uživatel ${interaction.user}.` });
                interaction.component.setDisabled(true);
            }

            if (interaction.customId === 'close_ticket_request') {
                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_close').setLabel('Uzavřít').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_close').setLabel('Zrušit').setStyle(ButtonStyle.Secondary)
                );
                const msg = await interaction.reply({ content: 'Opravdu si přejete tento ticket uzavřít?', components: [confirmRow], fetchReply: true });
                setTimeout(() => msg.delete().catch(() => {}), 60000);
            }

            if (interaction.customId === 'confirm_close') {
                await interaction.channel.send('Ticket se uzavírá...');
                setTimeout(() => interaction.channel.delete(), 3000);
            }

            if (interaction.customId === 'cancel_close') {
                await interaction.message.delete();
            }
        }
    });
};
