import { TextChannel } from 'discord.js'
import { event, Events, normalMessage, UserMessage, clean, shouldReply, messageHistoryCache } from '../utils/index.js'
import {
    getChannelInfo, getServerConfig, getUserConfig, openChannelInfo,
    openConfig, UserConfig, getAttachmentData, getTextFileAttachmentData
} from '../utils/index.js'
import Keys from '../keys.js'

/** 
 * Max Message length for free users is 2000 characters (bot or not).
 * Bot supports infinite lengths for normal messages.
 * 
 * @param message the message received from the channel
 */
export default event(Events.MessageCreate, async ({ log, msgHist, ollama, client, defaultModel }, message) => {
    const clientId = client.user!!.id
    let cleanedMessage = clean(message.content, clientId)
    log(`Message \"${cleanedMessage}\" from ${message.author.tag} in channel/thread ${message.channelId}.`)

    // Do not respond if bot talks in the chat
    if (message.author.username === message.client.user.username) return

    // Do not respond to other bots
    if (message.author.bot) return

    // Check if bot should respond
    const hasMention = message.mentions.has(clientId)
    
    // Don't analyze if mentioned - always respond to mentions
    if (!hasMention) {
        if (!Keys.autoReply) {
            // Auto reply is disabled and no mention, so don't respond
            return
        }
        
        // Get chat history for context
        let chatMessages: UserMessage[] = await new Promise((resolve) => {
            getChannelInfo(`${message.channelId}.json`, (channelInfo) => {
                if (channelInfo?.messages) {
                    resolve(channelInfo.messages)
                } else {
                    resolve([])
                }
            })
        })
        
        // Ask AI if we should reply to this message with context
        const shouldRespond = await shouldReply(ollama, cleanedMessage, defaultModel as string, chatMessages)
        if (!shouldRespond) return
        log(`AI decided to respond to non-mention message: "${cleanedMessage}"`)
    }

    // default stream to false
    let shouldStream = false

    // Params for Preferences Fetching
    const maxRetries = 3
    const delay = 1000 // in millisecons

    try {
        // Retrieve Server/Guild Preferences
        let attempt = 0
        while (attempt < maxRetries) {
            try {
                await new Promise((resolve, reject) => {
                    getServerConfig(`${message.guildId}-config.json`, (config) => {
                        // check if config.json exists
                        if (config === undefined) {
                            // Allowing chat options to be available
                            openConfig(`${message.guildId}-config.json`, 'toggle-chat', true)
                            reject(new Error('Failed to locate or create Server Preferences\n\nPlease try chatting again...'))
                        }

                        // check if chat is disabled
                        else if (!config.options['toggle-chat'])
                            reject(new Error('Admin(s) have disabled chat features.\n\n Please contact your server\'s admin(s).'))
                        else
                            resolve(config)
                    })
                })
                break // successful
            } catch (error) {
                ++attempt
                if (attempt < maxRetries) {
                    log(`Attempt ${attempt} failed for Server Preferences. Retrying in ${delay}ms...`)
                    await new Promise(ret => setTimeout(ret, delay))
                } else
                    throw new Error(`Could not retrieve Server Preferences, please try chatting again...`)
            }
        }

        // Reset attempts for User preferences
        attempt = 0
        let userConfig: UserConfig | undefined

        while (attempt < maxRetries) {
            try {
                // Retrieve User Preferences
                userConfig = await new Promise((resolve, reject) => {
                    getUserConfig(`${message.author.username}-config.json`, (config) => {
                        if (config === undefined) {
                            openConfig(`${message.author.username}-config.json`, 'message-style', false)
                            openConfig(`${message.author.username}-config.json`, 'switch-model', defaultModel)
                            reject(new Error('No User Preferences is set up.\n\nCreating preferences file with \`message-style\` set as \`false\` for regular message style.\nPlease try chatting again.'))
                            return
                        }

                        // check if there is a set capacity in config
                        else if (typeof config.options['modify-capacity'] !== 'number')
                            log(`Capacity is undefined, using default capacity of ${msgHist.capacity}.`)
                        else if (config.options['modify-capacity'] === msgHist.capacity)
                            log(`Capacity matches config as ${msgHist.capacity}, no changes made.`)
                        else {
                            log(`New Capacity found. Setting Context Capacity to ${config.options['modify-capacity']}.`)
                            msgHist.capacity = config.options['modify-capacity']
                        }

                        // set stream state
                        shouldStream = config.options['message-stream'] as boolean || false

                        if (typeof config.options['switch-model'] !== 'string')
                            reject(new Error(`No Model was set. Please set a model by running \`/switch-model <model of choice>\`.\n\nIf you do not have any models. Run \`/pull-model <model name>\`.`))

                        resolve(config)
                    })
                })
                break // successful
            } catch (error) {
                ++attempt
                if (attempt < maxRetries) {
                    log(`Attempt ${attempt} failed for User Preferences. Retrying in ${delay}ms...`)
                    await new Promise(ret => setTimeout(ret, delay))
                } else
                    throw new Error(`Could not retrieve User Preferences, please try chatting again...`)
            }
        }

        // Get channel-wide context from memory cache first
        let chatMessages: UserMessage[] = messageHistoryCache.getHistory(message.channelId)
        
        // If cache is empty, try to load from file
        if (chatMessages.length === 0) {
            chatMessages = await new Promise((resolve) => {
                getChannelInfo(`${message.channelId}.json`, (channelInfo) => {
                    if (channelInfo?.messages) {
                        // Load last 10 messages from file to cache
                        messageHistoryCache.setHistory(message.channelId, channelInfo.messages)
                        resolve(channelInfo.messages)
                    } else {
                        log(`Channel ${message.channelId} does not exist. File will be created shortly...`)
                        resolve([])
                    }
                })
            })
        }

        if (chatMessages.length === 0) {
            chatMessages = await new Promise((resolve, reject) => {
                openChannelInfo(message.channelId,
                    message.channel as TextChannel
                )
                getChannelInfo(`${message.channelId}.json`, (channelInfo) => {
                    if (channelInfo?.messages) {
                        messageHistoryCache.setHistory(message.channelId, channelInfo.messages)
                        resolve(channelInfo.messages)
                    } else {
                        log(`Channel ${message.channelId} does not exist. File will be created shortly...`)
                        reject(new Error(`Failed to find channel history. Try chatting again.`))
                    }
                })
            })
        }

        if (!userConfig)
            throw new Error(`Failed to initialize User Preference for **${message.author.username}**.\n\nIt's likely you do not have a model set. Please use the \`switch-model\` command to do that.`)

        // get message attachment if exists
        const attachment = message.attachments.first()
        let messageAttachment: string[] = []

        if (attachment && attachment.name?.endsWith(".txt"))
            cleanedMessage += await getTextFileAttachmentData(attachment)
        else if (attachment)
            messageAttachment = await getAttachmentData(attachment)

        const model: string = userConfig.options['switch-model']

        // Create new queue with existing history from cache
        msgHist.setQueue([...chatMessages])

        // Add the new user message
        const newUserMessage: UserMessage = {
            role: 'user',
            content: cleanedMessage,
            images: messageAttachment || [],
            username: message.author.username
        }
        
        // Add to queue for AI processing
        msgHist.enqueue(newUserMessage)
        
        // Trim queue if necessary
        while (msgHist.size() > msgHist.capacity) msgHist.dequeue()

        // response string for ollama to put its response
        const response: string = await normalMessage(message, ollama, model, msgHist, shouldStream, Keys.systemPrompt)

        // If something bad happened, don't save to cache
        if (response == undefined) return

        // Add user message to cache
        messageHistoryCache.addMessage(message.channelId, newUserMessage)
        
        // Add assistant response to cache
        const assistantMessage: UserMessage = {
            role: 'assistant',
            content: response,
            images: []
        }
        messageHistoryCache.addMessage(message.channelId, assistantMessage)

        // Save to file for persistence (using cache contents)
        await openChannelInfo(message.channelId,
            message.channel as TextChannel,
            messageHistoryCache.getHistory(message.channelId)
        )
    } catch (error: any) {
        message.reply(`**Error Occurred:**\n\n**Reason:** *${error.message}*`)
    }
})