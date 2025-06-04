import { Ollama } from "ollama";
import { UserMessage } from "./index.js";

/**
 * AIがメッセージにレスするべきかどうかを判断する関数
 * @param ollama Ollama client
 * @param message ユーザーのメッセージ
 * @param model 使用するモデル
 * @param chatHistory 過去のメッセージ履歴
 * @returns レスするべきかどうか（true/false）
 */
export async function shouldReply(
  ollama: Ollama,
  message: string,
  model: string,
  chatHistory: UserMessage[] = []
): Promise<boolean> {
  try {
    // 最近の会話履歴を整形（最新5件まで）
    const recentHistory = chatHistory
      .slice(-5)
      .map((msg) => {
        const speaker = msg.username
          ? `${msg.username}`
          : msg.role === "assistant"
          ? "ボット"
          : msg.role;
        return `${speaker}: ${msg.content}`;
      })
      .join("\n");

    const contextInfo = recentHistory
      ? `\n最近の会話:\n${recentHistory}\n`
      : "";

    const response = await ollama.chat({
      model: model,
      messages: [
        {
          role: "system",
          content: `あなたはDiscordチャンネルのメッセージを分析して、ボットが返事をするべきかどうかを判断します。
過去の会話の文脈を考慮して判断してください。

以下の場合は「yes」と答えてください：
- ボットやAIについて言及している
- 会話の流れ的にボットが反応するべき内容
- 前の会話の続きでボットへの返答が期待される

以下の場合は「no」と答えてください：
- 単純な独り言
- 他の人との私的な会話
- スパムや意味のない文字列
- 明らかにボットに向けられていない内容
- すでに他の人が答えている質問

「yes」または「no」のみで答えてください。理由は不要です。`,
          images: [],
        },
        {
          role: "user",
          content: `${contextInfo}以下の新しいメッセージにボットは返事をするべきですか？\n\n新しいメッセージ: ${message}`,
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
