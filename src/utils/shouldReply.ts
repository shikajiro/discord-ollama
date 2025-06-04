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
過去の会話の文脈を考慮して、控えめに判断してください。基本的には「no」と答え、本当に必要な場合のみ「yes」と答えてください。

以下の場合のみ「yes」と答えてください：
- ボットの名前が明確に呼ばれている
- ボットに対する直接的な質問がある
- ボットが前の発言をした直後で、明らかに返答が期待されている

それ以外は全て「no」と答えてください。特に：
- 一般的な質問や感想
- 他の人同士の会話
- 挨拶や雑談
- ボットへの言及がない内容
- すでに他の人が答えた質問
- 文脈的に無関係な新しい話題

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
