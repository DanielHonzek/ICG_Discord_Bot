const { 
    EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle,
    SlashCommandBuilder, Routes, REST
} = require('discord.js');

module.exports = async (client, db) => {
    const CHANNEL_ID = '1459071877275193457';
    const ARCHIVE_CATEGORY_ID = '1479807961215008984';
    const STAFF_PING_ROLE = '1459070165164757225';
    
    const AUTHORIZED_ROLES = [
        '1459070165164757225', '1466864975133016280', 
        '1467512663306404087', '1459070165164757225'
    ];

    const commands = [
        new SlashCommandBuilder().setName('uzavrit').setDescription('Požádá o uzavření ticketu'),
        new SlashCommandBuilder().setName('prevzit').setDescription('Převezme ticket').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    } catch (e) { console.error(e); }

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
            { q: 'Proč bychom měli vaší žádosti vyhovět?', len: 1000 }
        ],
        'report_player': [
            { q: 'Username hráče/uživatele', len: 100 },
            { q: 'Proč tohoto hráče chcete nahlásit?', len: 1000 }
        ],
        'report_staff': [
            { q: 'Username člena A-Teamu', len: 100 },
            { q: 'Proč tohoto člena chcete nahlásit?', len: 1000 }
        ]
    };

    const getButtons = (d1, d2, label) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Uzavřít').setStyle(ButtonStyle.Danger).setDisabled(d1),
        new ButtonBuilder().setCustomId('claim_ticket').setLabel(label).setStyle(label === 'Převzít' ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(d2)
    );

    client.once('ready', async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) return;
        const msgs = await channel.messages.fetch({ limit: 10 });
        if (!msgs.find(m => m.author.id === client.user.id && m.embeds.length > 0)) {
            const embed = new EmbedBuilder().setTitle('Podpora serveru').setDescription('Vyberte si kategorii pro otevření ticketu.').setColor('#5865F2');
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Vyberte kategorii...').addOptions(Object.entries(categoryNames).map(([v, l]) => ({ label: l, value: v }))));
            await channel.send({ embeds: [embed], components: [row] });
        }
    });

    client.on('interactionCreate', async (i) => {
        const handleClose = async (inter) => {
            const msgs = await inter.channel.messages.fetch({ limit: 50 });
            const main = msgs.find(m => m.author.id === client.user.id && m.components.length > 0 && m.components[0].components[0].customId === 'close_ticket_request');
            const claimed = main ? main.components[0].components[1].disabled : false;
            const label = main ? main.components[0].components[1].label : 'Převzít';
            if (main) await main.edit({ components: [getButtons(true, claimed, label)] });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirm_close').setLabel('Ano, uzavřít').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('cancel_close').setLabel('Zrušit').setStyle(ButtonStyle.Secondary));
            const reply = await inter.reply({ content: '⚠️ Opravdu si přejete tento ticket uzavřít?', components: [row], fetchReply: true });
            setTimeout(async () => {
                const check = await inter.channel.messages.fetch(reply.id).catch(() => null);
                if (check) {
                    await check.delete().catch(() => {});
                    if (main) await main.edit({ components: [getButtons(false, claimed, label)] });
                }
            }, 180000);
        };

        if (i.isChatInputCommand()) {
            if (!i.channel.name.startsWith('ticket-')) return i.reply({ content: 'Pouze v ticketu!', ephemeral: true });
            if (i.commandName === 'prevzit') {
                if (!AUTHORIZED_ROLES.some(id => i.member.roles.cache.has(id))) return i.reply({ content: 'Jen pro Staff!', ephemeral: true });
                const msgs = await i.channel.messages.fetch({ limit: 50 });
                const main = msgs.find(m => m.author.id === client.user.id && m.components.length > 0);
                if (main) await main.edit({ components: [getButtons(false, true, 'Převzato')] });
                await i.reply({ content: `Ticket převzal/a **${i.user.username}**.` });
            }
            if (i.commandName === 'uzavrit') await handleClose(i);
        }

        if (i.isStringSelectMenu() && i.customId === 'ticket_select') {
            if (i.guild.channels.cache.find(c => c.name === `ticket-${i.user.username.toLowerCase()}`)) return i.reply({ content: '❌ Už máš jeden aktivní ticket.', ephemeral: true });
            const type = i.values[0];
            const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle(categoryNames[type]);
            questionsMap[type].forEach((obj, idx) => {
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`q${idx}`).setLabel(obj.q.substring(0, 45)).setStyle(obj.len === 1000 ? TextInputStyle.Paragraph : TextInputStyle.Short).setMaxLength(obj.len).setRequired(true)));
            });
            await i.showModal(modal);
        }

        if (i.isModalSubmit()) {
            await i.deferReply({ ephemeral: true });
            const type = i.customId.replace('modal_', '');
            const channel = await i.guild.channels.create({
                name: `ticket-${i.user.username.toLowerCase()}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    ...AUTHORIZED_ROLES.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });
            const e1 = new EmbedBuilder().setDescription(`Úspěšně jste vytvořil ticket: **${categoryNames[type]}**\nNaš Discord Staff Team se vám bude věnovat hned jak to bude možné.`).setColor('#00FF00');
            const e2 = new EmbedBuilder().setTitle('Informace').setColor('#5865F2');
            questionsMap[type].forEach((obj, idx) => { e2.addFields({ name: obj.q, value: `\`\`\`${i.fields.getTextInputValue(`q${idx}`)}\`\`\`` }); });
            await channel.send({ content: `${i.user} | <@&${STAFF_PING_ROLE}>`, embeds: [e1, e2], components: [getButtons(false, false, 'Převzít')] });
            await i.editReply(`Ticket vytvořen: ${channel}`);
        }

        if (i.isButton()) {
            const label = i.message.components[0].components[1].label;
            const claimed = i.message.components[0].components[1].disabled;
            if (i.customId === 'claim_ticket') {
                if (!AUTHORIZED_ROLES.some(id => i.member.roles.cache.has(id))) return i.reply({ content: 'Jen pro Staff!', ephemeral: true });
                await i.message.edit({ components: [getButtons(false, true, 'Převzato')] });
                await i.reply({ content: `Ticket převzal/a **${i.user.username}**.` });
            }
            if (i.customId === 'close_ticket_request') await handleClose(i);
            if (i.customId === 'confirm_close') {
                await i.reply({ content: 'Archivuji...', ephemeral: true });
                await i.channel.setParent(ARCHIVE_CATEGORY_ID, { lockPermissions: false });
                await i.channel.permissionOverwrites.set([{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, ...AUTHORIZED_ROLES.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))]);
                await i.channel.send(`✅ Archivováno uživatelem **${i.user.username}**.`);
                await i.message.delete().catch(() => {});
            }
            if (i.customId === 'cancel_close') {
                const msgs = await i.channel.messages.fetch({ limit: 50 });
                const main = msgs.find(m => m.author.id === client.user.id && m.components.length > 0);
                if (main) await main.edit({ components: [getButtons(false, claimed, label)] });
                await i.message.delete().catch(() => {});
            }
        }
    });
};
