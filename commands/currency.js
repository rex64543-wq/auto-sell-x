const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('currency')
    .setDescription('Currency exchange system: convert amounts, view rates, or configure currencies')
    .addSubcommand(sub =>
      sub
        .setName('convert')
        .setDescription('Convert an amount between store currencies (e.g. INR to NPR, NPR to USD)')
        .addNumberOption(opt =>
          opt
            .setName('amount')
            .setDescription('The amount of money to convert')
            .setRequired(true)
            .setMinValue(0.01)
        )
        .addStringOption(opt =>
          opt
            .setName('from')
            .setDescription('Source currency code (default: INR)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('to')
            .setDescription('Target currency code (e.g. NPR, USD, INR or ALL)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('rates')
        .setDescription('View all supported store currencies and exchange values')
    )
    .addSubcommand(sub =>
      sub
        .setName('set_default')
        .setDescription('Set the default store currency (Staff / Owner only)')
        .addStringOption(opt =>
          opt
            .setName('currency')
            .setDescription('Currency code (e.g. USD, INR, NPR)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add or update a store currency (Staff / Owner only)')
        .addStringOption(opt =>
          opt
            .setName('code')
            .setDescription('3-letter currency code (e.g. NPR, EUR, GBP)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Currency name (e.g. Nepalese Rupee)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('symbol')
            .setDescription('Currency symbol (e.g. रू, $, ৳, €)')
            .setRequired(true)
        )
        .addNumberOption(opt =>
          opt
            .setName('rate')
            .setDescription('Exchange rate relative to 1 INR base (e.g. 1.6 for NPR, 0.012 for USD)')
            .setRequired(true)
            .setMinValue(0.000001)
        )
        .addStringOption(opt =>
          opt
            .setName('flag')
            .setDescription('Country flag emoji (e.g. 🇳🇵, 🇺🇸, 🇮🇳)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a currency from the store (Staff / Owner only)')
        .addStringOption(opt =>
          opt
            .setName('code')
            .setDescription('Currency code to remove (e.g. PKR)')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const currencies = db.getCurrencies();
    const rates = db.getCurrencyRates();
    const defaultCurr = db.getDefaultCurrency();

    // 1. /currency convert
    if (subcommand === 'convert') {
      const rawAmount = interaction.options.getNumber('amount');
      const fromCurr = (interaction.options.getString('from') || 'INR').toUpperCase().trim();
      const toCurr = interaction.options.getString('to')?.toUpperCase()?.trim();

      const fromObj = currencies.find(c => c.code === fromCurr);
      const fromRate = fromObj ? Number(fromObj.rate) : (Number(rates[fromCurr]) || (fromCurr === 'INR' ? 1.0 : null));

      if (!fromRate) {
        return interaction.reply({
          content: `❌ Unknown source currency **${fromCurr}**. Supported currencies: ${currencies.map(c => c.code).join(', ')}`,
          ephemeral: true
        });
      }

      const fromSymbol = fromObj ? fromObj.symbol : fromCurr;
      const fromFlag = fromObj ? fromObj.flag : '🌐';
      const fromName = fromObj ? fromObj.name : fromCurr;

      // Convert from source to INR base
      const inrAmount = rawAmount / fromRate;

      // If specific target currency requested
      if (toCurr && toCurr !== 'ALL') {
        const toObj = currencies.find(c => c.code === toCurr);
        const toRate = toObj ? Number(toObj.rate) : (Number(rates[toCurr]) || (toCurr === 'INR' ? 1.0 : null));

        if (!toRate) {
          return interaction.reply({
            content: `❌ Unknown target currency **${toCurr}**. Supported currencies: ${currencies.map(c => c.code).join(', ')}`,
            ephemeral: true
          });
        }

        const toSymbol = toObj ? toObj.symbol : toCurr;
        const toFlag = toObj ? toObj.flag : '🌐';
        const toName = toObj ? toObj.name : toCurr;

        let finalConverted;
        if (toCurr === 'USD' || toCurr === 'EUR' || toCurr === 'GBP' || toRate < 0.1) {
          finalConverted = (inrAmount * toRate).toFixed(2);
        } else {
          finalConverted = Math.round(inrAmount * toRate).toLocaleString();
        }

        const embed = new EmbedBuilder()
          .setColor(0x00d2ff)
          .setTitle('💱 Currency Conversion Result')
          .setDescription(
            `**Source Amount:**\n` +
            `${fromFlag} **${fromSymbol}${rawAmount.toLocaleString()} ${fromCurr}** *(${fromName})*\n\n` +
            `**Converted Amount:**\n` +
            `${toFlag} **${toSymbol}${finalConverted} ${toCurr}** *(${toName})*`
          )
          .setFooter({ text: 'Currency Exchange System • Real-Time Calculation' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // Convert to all store currencies
      const conversionsList = currencies.map(c => {
        let val;
        if (c.code === 'USD' || c.code === 'EUR' || c.code === 'GBP' || c.rate < 0.1) {
          val = (inrAmount * c.rate).toFixed(2);
        } else {
          val = Math.round(inrAmount * c.rate).toLocaleString();
        }
        const isFrom = c.code === fromCurr;
        return `${c.flag} **${c.name} (${c.code}):** \`${c.symbol}${val} ${c.code}\`${isFrom ? ' ⬅ *(Input)*' : ''}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x00d2ff)
        .setTitle('💱 Multi-Currency Exchange Rates')
        .setDescription(
          `**Input Amount:** ${fromFlag} **${fromSymbol}${rawAmount.toLocaleString()} ${fromCurr}**\n\n` +
          `**Equivalent in All Supported Store Currencies:**\n` +
          `${conversionsList}`
        )
        .setFooter({ text: 'Currency Exchange System • Real-Time Calculation' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. /currency rates
    if (subcommand === 'rates') {
      const list = currencies.map(c => {
        const isDefault = c.code === defaultCurr;
        return `${c.flag} **${c.code}** — ${c.name} (\`${c.symbol}\`)${isDefault ? ' ⭐ **[DEFAULT STORE CURRENCY]**' : ''}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🌐 Active Store Currencies')
        .setDescription(
          `Below are all currencies currently supported for checkout and display in the store:\n\n` +
          `${list}\n\n` +
          `💡 *Tip: Use \`/currency convert <amount> [from] [to]\` to exchange amounts instantly.*`
        )
        .setFooter({ text: `Default Store Currency: ${defaultCurr}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Staff-only check for set_default, add, remove
    const isStaff = db.isStaffOrOwner(interaction.member || interaction.user, interaction.guild);
    if (!isStaff) {
      return interaction.reply({
        content: '❌ **Access Denied:** Only Staff or Bot Owners can manage currency settings.',
        ephemeral: true
      });
    }

    // 3. /currency set_default
    if (subcommand === 'set_default') {
      const targetCode = interaction.options.getString('currency').toUpperCase().trim();
      try {
        const updated = db.setDefaultCurrency(targetCode);
        const curObj = db.getCurrencies().find(c => c.code === updated);

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Default Currency Updated')
          .setDescription(
            `The default store currency has been set to **${curObj ? curObj.flag : '🌐'} ${updated} (${curObj ? curObj.symbol : ''})**.\n` +
            `All shop prices, catalog previews, and default checkout menus will now use this currency.`
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({
          content: `❌ **Error:** ${err.message}`,
          ephemeral: true
        });
      }
    }

    // 4. /currency add
    if (subcommand === 'add') {
      const code = interaction.options.getString('code').toUpperCase().trim();
      const name = interaction.options.getString('name').trim();
      const symbol = interaction.options.getString('symbol').trim();
      const rate = interaction.options.getNumber('rate');
      const flag = interaction.options.getString('flag')?.trim() || '🌐';

      try {
        const added = db.addCurrency({ code, name, symbol, flag, rate });

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Currency Added / Updated')
          .setDescription(
            `Successfully saved currency:\n\n` +
            `• **Code:** \`${added.code}\`\n` +
            `• **Name:** ${added.flag} **${added.name}**\n` +
            `• **Symbol:** \`${added.symbol}\`\n` +
            `• **Rate vs 1 INR:** \`${added.rate}\``
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({
          content: `❌ **Error:** ${err.message}`,
          ephemeral: true
        });
      }
    }

    // 5. /currency remove
    if (subcommand === 'remove') {
      const code = interaction.options.getString('code').toUpperCase().trim();
      try {
        db.removeCurrency(code);

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🗑️ Currency Removed')
          .setDescription(`Successfully removed **${code}** from store currencies.`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({
          content: `❌ **Error:** ${err.message}`,
          ephemeral: true
        });
      }
    }
  }
};
