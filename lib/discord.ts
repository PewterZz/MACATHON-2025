import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

// Initialize Discord REST client for registering commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

// Create slash command
const commands = [
  new SlashCommandBuilder()
    .setName('helpme')
    .setDescription('Request peer support')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('What you need help with')
        .setRequired(true))
];

// Register slash commands
export const registerCommands = async (clientId: string) => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
};

// Initialize Discord client - modified for serverless environment
export const createDiscordClient = () => {
  try {
    const client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
      ] 
    });

    return client;
  } catch (error) {
    console.error("Error creating Discord client:", error);
    throw error;
  }
};

// Get or create client instance with lazy initialization
export const getDiscordClient = async () => {
  try {
    const client = createDiscordClient();
    await client.login(process.env.DISCORD_BOT_TOKEN);
    return client;
  } catch (error) {
    console.error("Failed to initialize Discord client:", error);
    throw error;
  }
}; 