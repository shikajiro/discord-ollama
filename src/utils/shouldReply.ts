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
          content: `あなたはDiscordチャンネルのメッセージを分析して、人間として自然に振る舞うべきかどうかを判断するAIです。

以下の場合に「yes」と答えてください：
- あなたの名前が明示的に呼ばれている（@メンション、名前での呼びかけなど）
- あなたに対する直接的な質問や依頼がある
- あなたが前の発言をした直後で、明らかに返答が期待されている文脈
- あなたの能力について質問されている
- あなたに何かをしてもらいたいという意図が明確
- 会話の流れで自然に参加できる場面
- 他の人からの質問や話題に自然に反応できる状況

「no」と答えるのは以下の場合のみ：
- 明らかに他の人同士のプライベートな会話
- あなたが参加するのが不自然な場面
- すでに他の人が適切に答えた質問
- あなたの存在を前提としない完全に無関係な話題

過去の会話履歴も考慮して、人間らしく自然な会話の流れを保つよう判断してください。

判断結果とその理由を以下の形式で答えてください：
「yes」または「no」: 理由`,
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
    const shouldReplyResult =
      decision.includes("yes") || decision.includes("はい");

    console.log(
      `[shouldReply] 判断結果: ${shouldReplyResult ? "返事する" : "返事しない"}`
    );
    console.log(`[shouldReply] AIの判断: ${response.message.content}`);

    return shouldReplyResult;
  } catch (error) {
    console.log("[shouldReply] Error:", error);
    return false; // エラーの場合は返事しない
  }
}
