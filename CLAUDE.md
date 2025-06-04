# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ビルド・開発コマンド

### 基本コマンド
- `npm run build` - TypeScriptをビルド
- `npm run client` - ビルド後、本番環境で実行
- `npm run watch` - 開発モード（ファイル変更監視）

### テストコマンド
- `npm run test:run` - Vitestでテスト実行
- `npm run test:coverage` - カバレッジ付きテスト実行

### Dockerコマンド
- `npm run start` - Docker Composeでビルド＆起動
- `npm run docker:start` - 個別コンテナ起動（GPU版）
- `npm run docker:start-cpu` - 個別コンテナ起動（CPU版）
- `npm run clean` - Dockerクリーンアップ

## アーキテクチャ概要

Discord-ollamaは、DiscordボットとOllama（ローカルLLM）を統合するプロジェクトです。3つのコンテナで構成されています：
- **discord**: Discordボット本体
- **ollama**: LLMモデルサーバー
- **redis**: データ永続化・キャッシュ

### コードの構成パターン
- **イベント駆動アーキテクチャ**: Discord.jsのイベントシステムベース
- **コマンドパターン**: 各スラッシュコマンドは`src/commands/`に独立したモジュールとして実装
- **ハンドラー分離**: ストリーム処理、設定管理、チャット履歴などは`src/utils/handlers/`に分離
- **環境変数管理**: `src/keys.ts`で一元管理（CLIENT_TOKEN、OLLAMA_HOSTなど重要な設定）

### 主要な処理フロー
1. ユーザーメッセージ → `events/messageCreate.ts`
2. チャット履歴管理 → `utils/handlers/chatHistoryHandler.ts`
3. Ollama API呼び出し → `ollama`パッケージ使用
4. レスポンスストリーミング → `utils/handlers/streamHandler.ts`
5. 2000文字超の処理 → `utils/handlers/bufferHandler.ts`で分割送信

### 設定管理システム
- ユーザー/サーバー設定は`utils/handlers/configHandler.ts`で管理
- 設定インターフェースは`utils/configInterfaces.ts`で定義
- デフォルトモデル: llama3.2:latest
- メッセージ履歴容量: デフォルト10件

## 開発時の注意点

- Node.js >=22.12.0、npm >=10.9.0が必要
- ESモジュール形式（"type": "module"）
- TypeScript厳格モード有効
- 新しいコマンドは`src/commands/index.ts`への登録が必要
- 新しいイベントは`src/events/index.ts`への登録が必要