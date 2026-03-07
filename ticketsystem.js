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
        '1467512663306404087', '1466335067029635163'
    ];

    const categoryNames = {
        'gen_support': 'Všeobecná podpora',
        'tech_support': 'Technická Podpora',
        'anticheat': 'AntiCheat',
        'unban_req': 'Žádost o zrušení trestu',
        'report_player': 'Nahlášení hráče/uživatele',
        'report_staff': 'Nahlášení člena A-Teamu'
    };

    const questionsMap = {
        'gen_support': ['S čím vám můžeme pomoct?'],
        'tech_support': ['O jaký technický problém se jedná?'],
        'anticheat': ['Co byste rádi řešili ohledně AntiCheatu?'],
        'unban_req': [
            'Jaké je vaše herní username/Discord username?',
            'Jaký trest jste dostal?',
            'Jaký byl důvod obdržení trestu?',
            'Kdy jste trest obdržel?',
            'Proč bychom měli vaší žádosti vyhovět?'
        ],
        'report_player': [
            'Jaké je username hráče/uživatele?',
            'Proč tohoto hráče chcete nahlásit?'
        ],
        'report_staff': [
            'Jaké je username člena A-Teamu?',
            'Proč tohoto člena chcete nahlásit?'
        ]
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
            const type = interaction.values[0];
            const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle(categoryNames[type]);
            const questions = questionsMap[type];

            questions.forEach((q, i) => {
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`q${i}`)
                        .setLabel(q.substring(0, 45))
                        .setStyle(q.length > 100 ? TextInputStyle.Paragraph : TextInputStyle.Short)
                        .setMaxLength(q.includes('username') || q.includes('trest') && !q.includes('důvod') ? 100 : 1000)
                        .setRequired(true)
                ));
            });
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });
            const typeValue = interaction.customId.replace('modal_', '');
            const typeLabel = categoryNames[typeValue];
            const questions = questionsMap[typeValue];
            
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
                .setDescription(`Úspěšně jste vytvořil ticket: **${typeLabel}**\nNaš Discord Staff Team se vám bude věnovat hned jak to bude možné. Děkujeme za vaší trpělivost.`)
                .setColor('#00FF00');

            const infoEmbed = new EmbedBuilder().setTitle('Informace').setColor('#5865F2');
            
            questions.forEach((question, index) => {
                const answer = interaction.fields.getTextInputValue(`q${index}`);
                infoEmbed.addFields({ name: question, value: `\`\`\`${answer}\`\`\`` });
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
                    return interaction.reply({ content: 'Tuto akci může provést pouze Staff!', ephemeral: true });
                }

                const oldRows = interaction.message.components[0];
                const newRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(oldRows.components[0]),
                    ButtonBuilder.from(oldRows.components[1]).setDisabled(true).setLabel('Převzato').setStyle(ButtonStyle.Secondary)
                );

                await interaction.update({ components: [newRow] });
                await interaction.followUp({ content: `Ticket převzal/a **${interaction.user.username}**.` });
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
                await interaction.message.delete().catch(() => {});
            }
        }
    });
};
