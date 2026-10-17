# 作家カレンダー（仮称）

好きな作家の展覧会を見逃さないためのサイト。全国の主要美術館の公式サイトの展覧会一覧を読み取り、作家ごとのページと購読カレンダー（.ics）を作る。

## 仕組み

- `data/museums/*.json` 対象の美術館（公式の展覧会一覧URL）
- `scripts/collect.mjs` 毎日、各館の一覧ページを読む。変わったページだけ Claude が展覧会を抽出し、`data/exhibitions/<館>.json` に追加。ページ上に見つからない展覧会名は捨てる。新しく見つかった展覧会は `data/announcements.json` に記録（新着一覧と、今後の LINE 通知に使う）
- `scripts/build.mjs` 静的サイトを `dist/` に出力。作家ページ、美術館ページ、展覧会ページ（Google/iPhone カレンダーに予定を1件追加するリンク付き）、検索
- `functions/api/line.js` LINE ボット。作家名を送ると候補が出て登録できる（応答は無料）。作家ページの「LINEで通知を受け取る」は登録用の文面を入れた状態で LINE を開く
- `functions/api/notify.js` デプロイのたびに呼ばれ、直近14日に発表された展覧会を、その作家を登録している人へ1人1通にまとめて送る。登録は Cloudflare D1（`schema.sql`）

## コマンド

    npm ci
    npm test
    npm run build        # dist/ を作る
    npm run serve        # http://localhost:4321 で確認
    npm run collect      # ANTHROPIC_API_KEY が必要

## 必要な設定（GitHub の Secrets）

- `ANTHROPIC_API_KEY` 展覧会の読み取り
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 公開（Cloudflare Pages の `artist-calendar` プロジェクト）。トークンには Pages Edit と D1 Edit の権限が必要
- `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` LINE ボット。LINE Developers で Webhook URL を `https://artist-calendar.pages.dev/api/line` にし、応答メッセージをオフにする
- `site.config.json` の `lineBasicId` に LINE のボット基本ID（@xxxx）を入れると、作家ページに登録ボタンが出る

## 方針

- 情報源は各館の公式サイトのみ。他社のまとめサイトは使わない
- 展覧会名・会期・会場・作家名などの事実のみ掲載し、紹介文は独自に書く。画像や公式の文章は転載しない
- `site.config.json` の `noindex` が true の間は検索エンジンに載らない
