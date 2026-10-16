# 作家カレンダー（仮称）

好きな作家の展覧会を見逃さないためのサイト。全国の主要美術館の公式サイトの展覧会一覧を読み取り、作家ごとのページと購読カレンダー（.ics）を作る。

## 仕組み

- `data/museums/*.json` 対象の美術館（公式の展覧会一覧URL）
- `scripts/collect.mjs` 毎日、各館の一覧ページを読む。変わったページだけ Claude が展覧会を抽出し、`data/exhibitions/<館>.json` に追加。ページ上に見つからない展覧会名は捨てる。新しく見つかった展覧会は `data/announcements.json` に記録（新着一覧と、今後の LINE 通知に使う）
- `scripts/build.mjs` 静的サイトを `dist/` に出力。作家ページ、美術館ページ、展覧会ページ、検索、作家・美術館ごとの購読カレンダー
- カレンダーは「開幕日」と「終了1週間前」の終日予定。購読なので新しい展覧会が自動で追加される

## コマンド

    npm ci
    npm test
    npm run build        # dist/ を作る
    npm run serve        # http://localhost:4321 で確認
    npm run collect      # ANTHROPIC_API_KEY が必要

## 必要な設定（GitHub の Secrets）

- `ANTHROPIC_API_KEY` 展覧会の読み取り
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 公開（Cloudflare Pages の `artist-calendar` プロジェクト）

## 方針

- 情報源は各館の公式サイトのみ。他社のまとめサイトは使わない
- 展覧会名・会期・会場・作家名などの事実のみ掲載し、紹介文は独自に書く。画像や公式の文章は転載しない
- `site.config.json` の `noindex` が true の間は検索エンジンに載らない
