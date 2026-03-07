const { 
    EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle 
} = require('discord.js');

module.exports = (client, db) => {
    const CHANNEL_ID = '1459071877275193457';
    const ARCHIVE_CATEGORY_ID = '1479807961215008984';
    const STAFF_PING_ROLE = '1459070165164757225';
    
    const AUTHORIZED_ROLES = [
        '1459070165164757225', '1466864975133016280', 
        '1467512663306404087', '1459070165164757225'
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
        'gen_support': [{ q: 'S čím vám můžeme pomoct?', len: 1000 }],
        'tech_support': [{ q: 'O jaký technický problém se jedná?', len: 1000 }],
        'anticheat': [{ q: 'Co byste rádi řešili ohledně AntiCheatu?', len: 1000 }],
        'unban_req': [
            { q: 'Vaše herní/Discord username', len: 100 },
            { q: 'Jaký trest jste dostal?', len: 100 },
            { q: 'Důvod obdržení trestu', len: 1000 },
            { q: 'Kdy jste trest obdržel?', len: 100 },
            { q: 'Proč bychom měli vyhovět?', len: 1000 }
        ],
        'report_player': [
            { q: 'Username hráče/uživatele', len: 100 },
            { q: 'Proč chcete hráče nahlásit?', len: 1000 }
        ],
        'report_staff': [
            { q: 'Username člena A-Teamu', len: 100 },
            { q: 'Proč chcete člena nahlásit?', len: 1000 }
        ]
    };

    client.once('ready', async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
        if (!botMessage) {
            const mainEmbed = new EmbedBuilder().setTitle('Podpora serveru').setDescription('Vyberte si kategorii z menu níže pro otevření ticketu.').setColor('#5865F2');
            const selectMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Vyberte kategorii ticketu...').addOptions(Object.entries(categoryNames).map(([value, label]) => ({ label, value }))));
            await channel.send({ embeds: [mainEmbed], components: [selectMenu] });
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            const existingTicket = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
            if (existingTicket) {
                return interaction.reply({ content: '❌ Už máš jeden aktivní ticket a více jich vytvořit nemůžeš.', ephemeral: true });
            }

            const type = interaction.values[0];
            const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle(categoryNames[type]);
            questionsMap[type].forEach((obj, i) => {
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId(`q${i}`).setLabel(obj.q.substring(0, 45)).setStyle(obj.len === 1000 ? TextInputStyle.Paragraph : TextInputStyle.Short).setMaxLength(obj.len).setRequired(true)
                ));
            });
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });
            const typeValue = interaction.customId.replace('modal_', '');
            
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    ...AUTHORIZED_ROLES.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });

            const welcomeEmbed = new EmbedBuilder().setDescription(`Úspěšně jste vytvořil ticket: **${categoryNames[typeValue]}**\nNaš Discord Staff Team se vám bude věnovat hned jak to bude možné. Děkujeme za vaší trpělivost.`).setColor('#00FF00');
            const infoEmbed = new EmbedBuilder().setTitle('Informace').setColor('#5865F2');
            questionsMap[typeValue].forEach((obj, index) => {
                infoEmbed.addFields({ name: obj.q, value: `\`\`\`${interaction.fields.getTextInputValue(`q${index}`)}\`\`\`` });
            });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Uzavřít').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Převzít').setStyle(ButtonStyle.Success)
            );

            await ticketChannel.send({ content: `${interaction.user} | <@&${STAFF_PING_ROLE}>`, embeds: [welcomeEmbed, infoEmbed], components: [buttons] });
            await interaction.editReply(`Ticket vytvořen: ${ticketChannel}`);
        }

        if (interaction.isButton()) {
            const updateMainButtons = async (disabledClose, disabledClaim, claimLabel) => {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Uzavřít').setStyle(ButtonStyle.Danger).setDisabled(disabledClose),
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel(claimLabel).setStyle(claimLabel === 'Převzít' ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(disabledClaim)
                );
                await interaction.message.edit({ components: [row] });
            };

            const currentClaimLabel = interaction.message.components[0].components[1].label;
            const isClaimed = interaction.message.components[0].components[1].disabled;

            if (interaction.customId === 'claim_ticket') {
                if (!AUTHORIZED_ROLES.some(id => interaction.member.roles.cache.has(id))) return interaction.reply({ content: 'Tuto akci může provést pouze Staff!', ephemeral: true });
                await updateMainButtons(false, true, 'Převzato');
                await interaction.reply({ content: `Ticket převzal/a **${interaction.user.username}**.` });
            }

            if (interaction.customId === 'close_ticket_request') {
                await updateMainButtons(true, isClaimed, currentClaimLabel);

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_close').setLabel('Ano, uzavřít').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_close').setLabel('Zrušit').setStyle(ButtonStyle.Secondary)
                );
                const reply = await interaction.reply({ content: '⚠️ Opravdu si přejete tento ticket uzavřít?', components: [confirmRow], fetchReply: true });

                setTimeout(async () => {
                    const msg = await interaction.channel.messages.fetch(reply.id).catch(() => null);
                    if (msg) {
                        await msg.delete().catch(() => {});
                        await updateMainButtons(false, isClaimed, currentClaimLabel);
                    }
                }, 180000);
            }

            if (interaction.customId === 'confirm_close') {
                await interaction.reply({ content: 'Ticket se archivuje...', ephemeral: true });
                
                const ticketOwnerId = interaction.channel.name.split('-')[1]; 
                const member = interaction.guild.members.cache.find(m => m.user.username.toLowerCase() === ticketOwnerId);

                await interaction.channel.setParent(ARCHIVE_CATEGORY_ID, { lockPermissions: false });
                
                await interaction.channel.permissionOverwrites.set([
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    ...AUTHORIZED_ROLES.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]);

                await interaction.channel.send(`✅ Ticket byl uzavřen a archivován uživatelem **${interaction.user.username}**.`);
                await interaction.message.delete().catch(() => {});
            }

            if (interaction.customId === 'cancel_close') {
                await updateMainButtons(false, isClaimed, currentClaimLabel);
                await interaction.message.delete().catch(() => {});
            }
        }
    });
};
