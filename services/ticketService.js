const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');

class TicketService {
  /**
   * Creates a private order ticket channel visible ONLY to the buyer and admin/staff.
   * @param {import('discord.js').Guild} guild
   * @param {import('discord.js').User} user
   * @param {Object} order
   * @param {Object} [product]
   * @returns {Promise<import('discord.js').TextChannel>}
   */
  async createOrderTicket(guild, user, order, product) {
    const settings = db.getSettings();
    const cleanUsername = user.username
      ? user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 15)
      : 'buyer';
    const isTopup = order.type === 'wallet_topup';
    const channelName = `ticket-${order.id.toLowerCase()}-${cleanUsername || 'client'}`;

    // Permission overwrites: private by default
    // @everyone is completely denied ViewChannel
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      // The Buyer (Client)
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.UseExternalEmojis
        ]
      },
      // The Bot
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ];

    // The Server Owner (Admin / "Me")
    if (guild.ownerId && guild.ownerId !== user.id) {
      permissionOverwrites.push({
        id: guild.ownerId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages
        ]
      });
    }

    // Server Staff / Admins (Any role with Administrator or ManageGuild, or customerRoleId)
    guild.roles.cache.forEach(role => {
      if (
        role.id !== guild.roles.everyone.id &&
        (role.permissions.has(PermissionFlagsBits.Administrator) ||
          role.permissions.has(PermissionFlagsBits.ManageGuild) ||
          (settings.customerRoleId && role.id === settings.customerRoleId))
      ) {
        permissionOverwrites.push({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages
          ]
        });
      }
    });

    const itemName = isTopup ? 'Wallet Top-up' : (product?.name || order.productName || 'Order');
    const channelOptions = {
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites,
      topic: `🔒 Private Order #${order.id} | Client: ${user.tag} (${user.id}) | Item: ${itemName}`
    };

    // Place under category if valid
    if (settings.ticketCategoryId && guild.channels.cache.has(settings.ticketCategoryId)) {
      channelOptions.parent = settings.ticketCategoryId;
    }

    const channel = await guild.channels.create(channelOptions);
    return channel;
  }

  /**
   * Creates a private ticket channel specifically for uploading payment screenshot proof.
   * Visible ONLY to the buyer and staff.
   * @param {import('discord.js').Guild} guild
   * @param {import('discord.js').User} user
   * @param {Object} order
   * @param {Object} [product]
   * @returns {Promise<import('discord.js').TextChannel>}
   */
  async createPicTicket(guild, user, order, product) {
    const settings = db.getSettings();
    const cleanUsername = user.username
      ? user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 15)
      : 'buyer';
    const isTopup = order.type === 'wallet_topup';
    const channelName = `proof-${order.id.toLowerCase()}-${cleanUsername || 'client'}`;

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.UseExternalEmojis
        ]
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ];

    if (guild.ownerId && guild.ownerId !== user.id) {
      permissionOverwrites.push({
        id: guild.ownerId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages
        ]
      });
    }

    guild.roles.cache.forEach(role => {
      if (
        role.id !== guild.roles.everyone.id &&
        (role.permissions.has(PermissionFlagsBits.Administrator) ||
          role.permissions.has(PermissionFlagsBits.ManageGuild) ||
          (settings.customerRoleId && role.id === settings.customerRoleId))
      ) {
        permissionOverwrites.push({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages
          ]
        });
      }
    });

    const itemName = isTopup ? 'Wallet Top-up' : (product?.name || order.productName || 'Order');
    const channelOptions = {
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites,
      topic: `📸 Private Proof Upload for Order #${order.id} | Client: ${user.tag} (${user.id}) | Item: ${itemName}`
    };

    if (settings.ticketCategoryId && guild.channels.cache.has(settings.ticketCategoryId)) {
      channelOptions.parent = settings.ticketCategoryId;
    }

    const channel = await guild.channels.create(channelOptions);
    return channel;
  }

  /**
   * Safely delete/close a ticket channel after a delay
   * @param {import('discord.js').TextChannel} channel
   * @param {number} delayMs
   * @param {string} reason
   */
  async closeTicket(channel, delayMs = 5000, reason = 'Order completed or closed') {
    try {
      setTimeout(async () => {
        try {
          if (channel && channel.deletable) {
            await channel.delete(reason);
          }
        } catch (err) {
          console.error(`Failed to delete channel ${channel?.id}:`, err?.message || err);
        }
      }, delayMs);
    } catch (err) {
      console.error('Error scheduling ticket close:', err);
    }
  }
}

module.exports = new TicketService();
