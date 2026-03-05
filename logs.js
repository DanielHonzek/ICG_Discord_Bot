module.exports = (client, db) => {
    
    client.on('messageDelete', async (message) => {
        if (message.author.bot) return;
        console.log(`Zpráva od ${message.author.tag} byla smazána: ${message.content}`);
        
        await db.collection('logs').add({
            action: 'message_delete',
            user: message.author.tag,
            content: message.content,
            timestamp: new Date()
        });
    });
};
