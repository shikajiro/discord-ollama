import { Channel, Client, CommandInteraction, MessageFlags, TextChannel } from 'discord.js'
import { clearChannelInfo, SlashCommand, UserCommand } from '../utils/index.js'

export const ClearUserChannelHistory: SlashCommand = {
    name: 'clear-channel-history',
    description: 'clears chat history for the current channel',

    // Clear channel history
    run: async (client: Client, interaction: CommandInteraction) => {
        // fetch current channel
        const channel: Channel | null = await client.channels.fetch(interaction.channelId)

        // if not an existing channel or a GuildText, fail command
        if (!channel || !UserCommand.includes(channel.type)) return

        // clear channel info
        const successfulWipe = await clearChannelInfo(
            interaction.channelId,
            interaction.channel as TextChannel
        )

        // check result of clearing history
        if (successfulWipe)
            interaction.reply({
                content: `Chat history cleared for **this channel**.`,
                flags: MessageFlags.Ephemeral
            })
        else
            interaction.reply({
                content: `No chat history found for **this channel**.\n\nPlease chat with **${client.user?.username}** to start a chat history.`,
                flags: MessageFlags.Ephemeral
            })
    }
}