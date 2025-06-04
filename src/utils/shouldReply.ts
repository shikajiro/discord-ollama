import { Ollama } from "ollama";

/**
 * AIがメッセージにレスするべきかどうかを判断する関数
 * @param ollama Ollama client
 * @param message ユーザーのメッセージ
 * @param model 使用するモデル
 * @returns レスするべきかどうか（true/false）
 */
export async function shouldReply(
  ollama: Ollama,
  message: string,
  model: string
): Promise<boolean> {
  try {
    const response = await ollama.chat({
      model: model,
      messages: [
        {
          role: "system",
          content: `あなたはDiscordチャンネルのメッセージを分析して、ボットが返事をするべきかどうかを判断します。

以下の場合は「yes」と答えてください：
- ボットやAIについて言及している

以下の場合は「no」と答えてください：
- 単純な独り言
- 他の人との私的な会話
- スパムや意味のない文字列
- 明らかにボットに向けられていない内容

「yes」または「no」のみで答えてください。理由は不要です。`,
          images: [],
        },
        {
          role: "user",
          content: `以下のメッセージにボットは返事をするべきですか？\n\n${message}`,
          images: [],
        },
      ],
      stream: false,
    });

    const decision = response.message.content.toLowerCase().trim();
    return decision.includes("yes") || decision.includes("はい");
  } catch (error) {
    console.log("[shouldReply] Error:", error);
    return false; // エラーの場合は返事しない
  }
}
