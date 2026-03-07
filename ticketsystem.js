const { 
    EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle 
} = require('discord.js');

module.exports = (client, db) => {
    const CHANNEL_ID = '1459071877275193457';
    const STAFF_PING_ROLE = '1459070165164757225';
    
    const AUTHORIZED_ROLES = [
        '1459070165164757225', '1466864975133016280', 
        '1467512663306404087', '1459168937752137842'
    ];

    const categoryNames = {
        'gen_support': 'Všeobecná podpora',
        'tech_support': 'Technická Podpora',
        'anticheat': 'AntiCheat',
        'unban_req': 'Žádost o zrušení trestu',
        'report_player': 'Nahlášení hráče/uživatele',
        'report_staff': 'Nahlášení člena A-Teamu'
    };

    client.once('ready', async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 });
        const botMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

        if (!botMessage) {
            const mainEmbed = new EmbedBuilder()
                .setTitle('Podpora serveru')
                .setDescription('Vyberte si kategorii z menu níže pro otevření ticketu.')
                .setColor('#5865F2');

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder('Vyberte kategorii ticketu...')
                    .addOptions(Object.entries(categoryNames).map(([value, label]) => ({ label, value })))
            );

            await channel.send({ embeds: [mainEmbed], components: [selectMenu] });
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            const modal = new ModalBuilder().setCustomId(`modal_${interaction.values[0]}`).setTitle(categoryNames[interaction.values[0]]);

            const addInput = (id, label, style, length) => {
                return new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(id)
                        .setLabel(label)
                        .setPlaceholder(`Max. ${length} znaků`)
                        .setStyle(style)
                        .setMaxLength(length)
                        .setRequired(true)
                );
            };

            if (interaction.values[0] === 'gen_support') {
                modal.addComponents(addInput('q1', 'S čím vám můžeme pomoct?', TextInputStyle.Paragraph, 1000));
            } else if (interaction.values[0] === 'tech_support') {
                modal.addComponents(addInput('q1', 'O jaký technický problém se jedná?', TextInputStyle.Paragraph, 1000));
            } else if (interaction.values[0] === 'anticheat') {
                modal.addComponents(addInput('q1', 'Co byste rádi řešili ohledně AntiCheatu?', TextInputStyle.Paragraph, 1000));
            } else if (interaction.values[0] === 'unban_req') {
                modal.addComponents(
                    addInput('q1', 'Vaše herní/Discord username', TextInputStyle.Short, 100),
                    addInput('q2', 'Jaký trest jste dostal?', TextInputStyle.Short, 100),
                    addInput('q3', 'Důvod obdržení trestu', TextInputStyle.Paragraph, 1000),
                    addInput('q4', 'Kdy jste trest obdržel?', TextInputStyle.Short, 100),
                    addInput('q5', 'Proč bychom měli vyhovět?', TextInputStyle.Paragraph, 1000)
                );
            } else if (interaction.values[0] === 'report_player') {
                modal.addComponents(
                    addInput('q1', 'Username hráče/uživatele', TextInputStyle.Short, 100),
                    addInput('q2', 'Proč chcete hráče nahlásit?', TextInputStyle.Paragraph, 1000)
                );
            } else if (interaction.values[0] === 'report_staff') {
                modal.addComponents(
                    addInput('q1', 'Username člena A-Teamu', TextInputStyle.Short, 100),
                    addInput('q2', 'Proč chcete člena nahlásit?', TextInputStyle.Paragraph, 1000)
                );
            }

            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });
            const typeValue = interaction.customId.replace('modal_', '');
            const typeLabel = categoryNames[typeValue];
            
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    ...AUTHORIZED_ROLES.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Úspěšně jste vytvořil ticket: ${typeLabel}`)
                .setDescription(`Naš Discord Staff Team se vám bude věnovat hned jak to bude možné. Děkujeme za vaší trpělivost.`)
                .setColor('#00FF00');

            const infoEmbed = new EmbedBuilder().setTitle('Informace z formuláře').setColor('#5865F2');
            
            interaction.fields.fields.forEach((field, index) => {
                infoEmbed.addFields({ name: `Detail č. ${index + 1}`, value: `\`\`\`${field.value}\`\`\`` });
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

            await interaction.editReply(`Ticket vytvořen v kanálu ${ticketChannel}`);
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'claim_ticket') {
                if (!AUTHORIZED_ROLES.some(id => interaction.member.roles.cache.has(id))) {
                    return interaction.reply({ content: 'Tuto akci může provést pouze Staff!', ephemeral: true });
                }
                await interaction.reply({ content: `Ticket převzal/a **${interaction.user.username}**.` });
            }

            if (interaction.customId === 'close_ticket_request') {
                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_close').setLabel('Ano, uzavřít').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_close').setLabel('Zrušit').setStyle(ButtonStyle.Secondary)
                );
                const reply = await interaction.reply({ content: 'Opravdu si přejete tento ticket uzavřít?', components: [confirmRow], fetchReply: true });
                setTimeout(() => reply.delete().catch(() => {}), 60000);
            }

            if (interaction.customId === 'confirm_close') {
                await interaction.channel.send('Ticket bude smazán za 3 sekundy...');
                setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
            }

            if (interaction.customId === 'cancel_close') {
                await interaction.message.delete();
            }
        }
    });
};
