import { UserMessage } from './index.js'

/**
 * In-memory cache for channel message history
 * Maintains the last N messages per channel
 */
export class MessageHistoryCache {
    private cache: Map<string, UserMessage[]> = new Map()
    private maxMessages: number

    constructor(maxMessages: number = 10) {
        this.maxMessages = maxMessages
    }

    /**
     * Get message history for a channel
     * @param channelId Discord channel ID
     * @returns Array of messages, empty if channel not found
     */
    getHistory(channelId: string): UserMessage[] {
        return this.cache.get(channelId) || []
    }

    /**
     * Add a message to channel history
     * @param channelId Discord channel ID
     * @param message Message to add
     */
    addMessage(channelId: string, message: UserMessage): void {
        const history = this.getHistory(channelId)
        history.push(message)
        
        // Keep only the last N messages
        if (history.length > this.maxMessages) {
            history.splice(0, history.length - this.maxMessages)
        }
        
        this.cache.set(channelId, history)
    }

    /**
     * Set entire message history for a channel
     * @param channelId Discord channel ID
     * @param messages Array of messages
     */
    setHistory(channelId: string, messages: UserMessage[]): void {
        // Keep only the last N messages
        const trimmedMessages = messages.slice(-this.maxMessages)
        this.cache.set(channelId, trimmedMessages)
    }

    /**
     * Clear history for a specific channel
     * @param channelId Discord channel ID
     */
    clearChannel(channelId: string): void {
        this.cache.delete(channelId)
    }

    /**
     * Clear all cached history
     */
    clearAll(): void {
        this.cache.clear()
    }
}

// Global instance
export const messageHistoryCache = new MessageHistoryCache(10)