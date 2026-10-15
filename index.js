require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const interactionHandler = require('./handlers/interactionHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Load commands from /commands directory
const commands = [];
const commandFiles = fs
  .readdirSync(path.join(__dirname, 'commands'))
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (command.data && command.execute) {
    interactionHandler.registerCommand(command);
    commands.push(command.data.toJSON());
  }
}

/**
 * Register slash commands with Discord REST API
 */
async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID || '1559862419537268777';
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    console.warn('⚠️ DISCORD_TOKEN missing in environment variables. Skipping slash command registration.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`🔄 Refreshing ${commands.length} application (/) commands...`);

    if (guildId) {
      // Guild commands register instantly (ideal for development & single server)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands
      });
      console.log(`✅ Successfully registered slash commands for Guild ID: ${guildId}!`);
    } else {
      // Global commands
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands
      });
      console.log('✅ Successfully registered global slash commands!');
    }
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
}

const { startDashboard } = require('./dashboard/server');

// Start Web Dashboard immediately on launch so cloud platforms detect the open port instantly
startDashboard(client);

const handleReady = (readyClient) => {
  const botUser = readyClient?.user || client.user;
  console.log('=============================================');
  console.log(`🤖 Logged in as: ${botUser?.tag || 'Discord Bot'}`);
  console.log(`🌐 Serving in ${client.guilds.cache.size} server(s)`);
  console.log('=============================================');

  if (client.user) {
    client.user.setPresence({
      activities: [{ name: '🛒 Store | /help', type: ActivityType.Watching }],
      status: 'online'
    });
  }

  // Non-blocking auto-deploy commands on launch
  deployCommands().catch(err => console.error('Command registration error:', err));
};

client.once('clientReady', handleReady);
client.once('ready', handleReady);

const db = require('./database/db');
const purchaseFlow = require('./handlers/purchaseFlow');

client.on('interactionCreate', async interaction => {
  console.log(`⚡ [Discord Event] Interaction received: ${interaction.type} | Command: /${interaction.commandName || interaction.customId || 'unknown'} by ${interaction.user?.tag}`);
  await interactionHandler.handleInteraction(interaction);
});

// Direct gallery screenshot listener (DMs & Ticket channels)
client.on('messageCreate', async message => {
  try {
    if (message.author.bot) return;

    // Case 1: In Direct Message (DM) to the bot
    if (!message.guild && message.attachments.size > 0) {
      const attachment = message.attachments.first();
      const isImage =
        (attachment.contentType && attachment.contentType.startsWith('image/')) ||
        /\.(png|jpe?g|webp|gif)$/i.test(attachment.name || attachment.url);

      if (isImage) {
        const orders = db.getOrders();
        const pendingOrders = Object.values(orders)
          .filter(o => o.userId === message.author.id && o.status === 'pending_payment')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const order = pendingOrders[0];
        if (order) {
          const updatedOrder = db.updateOrder(order.id, {
            status: 'pending_verification',
            proofUrl: attachment.url,
            submittedAt: new Date().toISOString()
          });

          const isTopup = order.type === 'wallet_topup';
          await message.reply({
            content:
              `✅ **Payment Screenshot Received! (Order #${order.id})**\n` +
              `Thank you! Your payment proof has been submitted to staff for manual verification.\n` +
              (isTopup
                ? `Once verified, your **Wallet Balance** will be credited automatically!`
                : `Once verified, your **License Key** will be delivered right here in your DMs!`)
          });

          const adminVerifyFlow = require('./handlers/adminVerifyFlow');
          await adminVerifyFlow.sendVerificationCardToStaff(message.client, updatedOrder);

          // If order had an auto-created ticket room, notify there too
          if (order.ticketChannelId) {
            try {
              const ticketChan = await message.client.channels.fetch(order.ticketChannelId);
              if (ticketChan && ticketChan.isTextBased()) {
                await ticketChan.send({
                  content: `📸 <@${message.author.id}> has submitted their payment screenshot via **Bot DM**! Staff verification in progress.`
                });
              }
            } catch (_) {}
          }
        }
      }
      return;
    }

    // Case 2: In a private ticket / proof channel
    if (message.guild && message.attachments.size > 0) {
      const orders = db.getOrders();
      const order = Object.values(orders).find(
        o => o.ticketChannelId === message.channel.id && o.status === 'pending_payment'
      );

      if (order) {
        const attachment = message.attachments.first();
        const isImage =
          (attachment.contentType && attachment.contentType.startsWith('image/')) ||
          /\.(png|jpe?g|webp|gif)$/i.test(attachment.name || attachment.url);

        if (isImage) {
          await purchaseFlow.handleAttachmentProof(message, order);
        }
      }
    }
  } catch (err) {
    console.error('Error handling message attachment:', err);
  }
});

// Global error safety
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

const rawToken = process.env.DISCORD_TOKEN;
const token = rawToken ? rawToken.trim().replace(/^["']|["']$/g, '') : null;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.log('================================================================');
  console.log('⚠️  DISCORD_TOKEN is NOT set in Render Environment Variables!');
  console.log('   Go to Render -> Environment tab -> Add:');
  console.log('   Key: DISCORD_TOKEN');
  console.log('   Value: [Your Discord Bot Token]');
  console.log('================================================================');
} else {
  console.log(`🤖 Attempting Discord Gateway login (token length: ${token.length})...`);
  client.login(token).then(() => {
    console.log('✅ client.login resolved: Bot connected to Discord Gateway successfully!');
  }).catch(err => {
    console.error('❌ Failed to log in to Discord:', err);
  });
}
