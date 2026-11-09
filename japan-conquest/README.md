# SEIHA（日本制覇スタンプ帳）

外国人旅行者向けの「日本制覇」サイトです。各都道府県にスタンプが **10個（グルメ5・体験5）** あります。
白地図は、スタンプを1つ押すとその県が **薄い赤**、10個そろうと **濃い赤（制覇）** になります。
Cloudflare Workers ＋ D1 ＋ Hono で動きます（「全国マーケティング旅」と同じ仕組み）。

## 2つの構想から引き継いだもの

| 引き継いだもの | 元 |
|---|---|
| Workers ＋ D1 ＋ Hono、フォルダなしのファイル構成、ダッシュボードだけで公開できる手順 | marketing-trip |
| 本物の形の日本地図（amCharts の地図データ → SVG）、沖縄の枠表示 | marketing-trip |
| パスワードのハッシュ化（PBKDF2）、HttpOnly クッキー、別サイトからの書き込み拒否 | marketing-trip（auth.js はそのまま） |
| 英語が基本・日本語に切り替え、地方 → 県 → 都市の階層 | japan-travel-site |
| 1スポットの情報を絞る（名前＋一言説明）、「掲載前に公式で再確認」の注意 | japan-travel-site |

新しく足したもの：だれでも登録できる会員機能、ユーザーごとの記録、食／アクティビティのスタンプ、登録前（ゲスト）の記録をブラウザに保存して登録時に引き継ぐ仕組み。

## 画面（1ページで切り替え）

| URL | 内容 |
|---|---|
| `/#home` | 画面いっぱいの白地図（ピンチ・ドラッグ・＋−で拡大移動、県をタップで県ページへ）→ 下に集計と地方別一覧 |
| `/#pref-osaka` | 県ページ：グルメ5・体験5のスタンプ（各スタンプに都市名つき） |
| `/#passport` | スタンプ帳：押したスタンプを新しい順に、制覇した県の印 |
| `/#account` | 新規登録・ログイン |

地図の色：白＝0個、薄い赤＝1〜9個、濃い赤＝10個で制覇。

## 粒度について
地図は **都道府県単位** で塗ります。データは **県 → 都市 → 体験** の3段なので、都市や体験は行を足すだけで増やせます。
今は 47都道府県 × 10個 ＝ 470スタンプ（グルメ235・体験235）、241都市が入っています。
将来「市区町村の地図」に広げるときも、`cities` テーブルはそのまま使えます。

## ファイル

| ファイル | 役割 |
|---|---|
| `wrangler.toml` | Workers の設定（Worker名・D1の接続） |
| `package.json` | 使うツール（Hono・wrangler） |
| `worker.js` | 本体：API と画面を返す |
| `auth.js` | パスワードのハッシュ化・ログイン用トークン |
| `app.html` | 画面のすべて（デザイン・地図・スタンプ） |
| `schema.sql` | D1 のテーブル |
| `catalog-data.mjs` | 地方・県の一覧とカタログの組み立て |
| `stamps-east.mjs` / `stamps-central.mjs` / `stamps-west.mjs` | 各県のスタンプ10個（**ここを編集**。東日本／中部・関西／西日本） |
| `make-seed.mjs` | catalog-data.mjs から seed.sql を作る |
| `seed.sql` | 地方・県・都市・体験の初期データ（自動生成） |
| `japan-map.html` | 日本地図の形（自動生成。`node make-map.mjs` で作り直し）。ページに直接組み込むので外部サイトに頼らず表示されます |
| `make-map.mjs` | 地図の形を作る（`npm install` 後に実行） |
| `AMCHARTS-LICENSE.txt` | 地図データ（amCharts）のライセンス |

## データベース設計（D1：japan-conquest-db）

| テーブル | 役割 | 主な項目 |
|---|---|---|
| `regions` | 地方（9） | id, name_en, name_ja |
| `prefectures` | 都道府県（47固定・JISコード） | id, slug, name_en, name_ja, region_id |
| `cities` | 都市 | id（例 `osaka-city`）, prefecture_id, name_en, name_ja |
| `experiences` | 体験スタンプ | id（例 `osaka-city.takoyaki`）, city_id, category（`food`/`activity`）, name/desc（英日）, active |
| `users` | 旅行者 | id, username, password_hash, country, created_at |
| `visits` | 行った都市 | user_id, city_id, visited_at |
| `stamps` | 押したスタンプ | user_id, experience_id, stamped_at |

スタンプを押すと、その都市は自動で `visits` に記録されます（将来の都市単位の地図用）。

## 公開手順（はじめて）

1. **D1 を作る**：Cloudflare「Storage & Databases」→「D1 SQL Database」→「Create Database」→ 名前 `japan-conquest-db`
2. Console に `schema.sql` を貼って Execute → 続けて `seed.sql` を貼って Execute
   確認：`SELECT COUNT(*) FROM experiences;` → `470`
3. `wrangler.toml` の `database_id` に D1 の ID を入れる
4. GitHub のリポジトリの一番上にファイルを全部アップロード（Worker の「ビルド」のルートは `/`）
5. Worker →「設定」→「変数とシークレット」→ シークレット `JWT_SECRET`（32文字以上のランダムな英数字）
6. 確認：`/api/catalog` で一覧の JSON が出る → `/` を開いてスタンプを押す → `/#account` で登録

## 体験を追加・変更する

1. `stamps-*.mjs` の該当県の行を書き換える（グルメ `f` と体験 `a` は各5個ちょうど。数が違うと make-seed.mjs がエラーで教えてくれます）
2. `node make-seed.mjs` → `seed.sql` が作り直される
3. `seed.sql` を D1 の Console で実行（同じIDは上書きなので何度実行してもOK）

**体験のID（`都市id.key`）は公開後に変えないでください。** ユーザーのスタンプがそのIDで記録されています。
やめたい体験は削除せず `UPDATE experiences SET active = 0 WHERE id = '…';` で非表示にします。

## パソコンで動かす場合（任意）
```bash
npm install
npm run db:local
echo "JWT_SECRET=ローカル用の長いランダムな文字列" > .dev.vars
npm run dev      # http://localhost:8787
```

## よく使う SQL（D1 の Console）
```sql
-- 人気のスタンプ TOP10
SELECT e.name_en, COUNT(*) AS n FROM stamps s JOIN experiences e ON e.id = s.experience_id
GROUP BY e.id ORDER BY n DESC LIMIT 10;

-- 登録者数と、1人あたりの平均スタンプ数
SELECT (SELECT COUNT(*) FROM users) AS users,
       ROUND((SELECT COUNT(*) FROM stamps) * 1.0 / MAX((SELECT COUNT(*) FROM users), 1), 1) AS avg_stamps;
```

## 注意
- 体験の説明文は一般的な情報です。営業時間・料金・季節（松葉がには冬、雪の大谷は春など）は掲載前に公式で確認してください。
- 地図データは amCharts の無料ライセンス（リンク表記が条件）。フッターに表記済みです。商用で気になる場合は国土数値情報などのオープンデータへの差し替えを検討してください。
- 新規登録の回数制限はまだありません。公開後に荒らしが心配なら Cloudflare の「Rate limiting rules」で `/api/signup` と `/api/login` を制限してください。
