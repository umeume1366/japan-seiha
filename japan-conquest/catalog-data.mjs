import EAST from "./stamps-east.mjs";
import CENTRAL from "./stamps-central.mjs";
import WEST from "./stamps-west.mjs";

/**
 * 体験スタンプの元データ（ここを編集 → `node make-seed.mjs` で seed.sql を作り直す）
 *
 * 階層：地方（REGIONS）→ 都道府県（PREFECTURES・47件固定）→ 都市 → スタンプ
 * スタンプは各県10個：グルメ5（f）＋体験5（a）。中身は stamps-east / stamps-central / stamps-west.mjs
 *
 * 県の形：{ c: [[都市id, 英語名, 日本語名], ...], f: [グルメ×5], a: [体験×5] }
 * スタンプの行：[都市id, key, 英語名, 日本語名, 英語の一言説明, 日本語の一言説明]
 *   スタンプのIDは「都市id.key」（例：osaka-city.takoyaki）になります。一度公開したら変えないでください
 *   （ユーザーのスタンプはこのIDで記録されます）。
 *
 * ※ 説明文は掲載前に公式情報で再確認してください。
 */

export const REGIONS = [
  ["hokkaido", "Hokkaido", "北海道"],
  ["tohoku", "Tohoku", "東北"],
  ["kanto", "Kanto", "関東"],
  ["chubu", "Chubu", "中部"],
  ["kansai", "Kansai", "関西"],
  ["chugoku", "Chugoku", "中国"],
  ["shikoku", "Shikoku", "四国"],
  ["kyushu", "Kyushu", "九州"],
  ["okinawa", "Okinawa", "沖縄"],
];

// [JISコード, slug, 英語名, 日本語名, 地方id]
export const PREFECTURES = [
  [1, "hokkaido", "Hokkaido", "北海道", "hokkaido"],
  [2, "aomori", "Aomori", "青森県", "tohoku"],
  [3, "iwate", "Iwate", "岩手県", "tohoku"],
  [4, "miyagi", "Miyagi", "宮城県", "tohoku"],
  [5, "akita", "Akita", "秋田県", "tohoku"],
  [6, "yamagata", "Yamagata", "山形県", "tohoku"],
  [7, "fukushima", "Fukushima", "福島県", "tohoku"],
  [8, "ibaraki", "Ibaraki", "茨城県", "kanto"],
  [9, "tochigi", "Tochigi", "栃木県", "kanto"],
  [10, "gunma", "Gunma", "群馬県", "kanto"],
  [11, "saitama", "Saitama", "埼玉県", "kanto"],
  [12, "chiba", "Chiba", "千葉県", "kanto"],
  [13, "tokyo", "Tokyo", "東京都", "kanto"],
  [14, "kanagawa", "Kanagawa", "神奈川県", "kanto"],
  [15, "niigata", "Niigata", "新潟県", "chubu"],
  [16, "toyama", "Toyama", "富山県", "chubu"],
  [17, "ishikawa", "Ishikawa", "石川県", "chubu"],
  [18, "fukui", "Fukui", "福井県", "chubu"],
  [19, "yamanashi", "Yamanashi", "山梨県", "chubu"],
  [20, "nagano", "Nagano", "長野県", "chubu"],
  [21, "gifu", "Gifu", "岐阜県", "chubu"],
  [22, "shizuoka", "Shizuoka", "静岡県", "chubu"],
  [23, "aichi", "Aichi", "愛知県", "chubu"],
  [24, "mie", "Mie", "三重県", "kansai"],
  [25, "shiga", "Shiga", "滋賀県", "kansai"],
  [26, "kyoto", "Kyoto", "京都府", "kansai"],
  [27, "osaka", "Osaka", "大阪府", "kansai"],
  [28, "hyogo", "Hyogo", "兵庫県", "kansai"],
  [29, "nara", "Nara", "奈良県", "kansai"],
  [30, "wakayama", "Wakayama", "和歌山県", "kansai"],
  [31, "tottori", "Tottori", "鳥取県", "chugoku"],
  [32, "shimane", "Shimane", "島根県", "chugoku"],
  [33, "okayama", "Okayama", "岡山県", "chugoku"],
  [34, "hiroshima", "Hiroshima", "広島県", "chugoku"],
  [35, "yamaguchi", "Yamaguchi", "山口県", "chugoku"],
  [36, "tokushima", "Tokushima", "徳島県", "shikoku"],
  [37, "kagawa", "Kagawa", "香川県", "shikoku"],
  [38, "ehime", "Ehime", "愛媛県", "shikoku"],
  [39, "kochi", "Kochi", "高知県", "shikoku"],
  [40, "fukuoka", "Fukuoka", "福岡県", "kyushu"],
  [41, "saga", "Saga", "佐賀県", "kyushu"],
  [42, "nagasaki", "Nagasaki", "長崎県", "kyushu"],
  [43, "kumamoto", "Kumamoto", "熊本県", "kyushu"],
  [44, "oita", "Oita", "大分県", "kyushu"],
  [45, "miyazaki", "Miyazaki", "宮崎県", "kyushu"],
  [46, "kagoshima", "Kagoshima", "鹿児島県", "kyushu"],
  [47, "okinawa", "Okinawa", "沖縄県", "okinawa"],
];

export const STAMPS = { ...EAST, ...CENTRAL, ...WEST };
export const PER_CATEGORY = 5; // 各県のグルメ・体験の数

/** API と同じ形に整えたカタログ（make-seed.mjs・デモ版で使う） */
export function buildCatalog() {
  const cities = [], experiences = [];
  PREFECTURES.forEach(([code, slug]) => {
    const p = STAMPS[slug];
    if (!p) throw new Error("スタンプがない県: " + slug);
    if (p.f.length !== PER_CATEGORY || p.a.length !== PER_CATEGORY) throw new Error(`${slug}: グルメ${p.f.length}・体験${p.a.length}（各${PER_CATEGORY}必要）`);
    const ids = new Set(p.c.map((c) => c[0]));
    p.c.forEach(([id, en, ja], i) => cities.push({ id, pref: code, en, ja, sort: i + 1 }));
    [["food", p.f], ["activity", p.a]].forEach(([cat, rows]) => rows.forEach(([city, key, en, ja, den, dja], i) => {
      if (!ids.has(city)) throw new Error(`${slug}: 都市 ${city} が c にない`);
      experiences.push({ id: `${city}.${key}`, city, cat, en, ja, den, dja, sort: i + 1 });
    }));
  });
  const seen = new Set();
  for (const x of [...cities.map((c) => "c:" + c.id), ...experiences.map((e) => "e:" + e.id)]) {
    if (seen.has(x)) throw new Error("IDが重複: " + x);
    seen.add(x);
  }
  return {
    regions: REGIONS.map(([id, en, ja], i) => ({ id, en, ja, sort: i + 1 })),
    prefectures: PREFECTURES.map(([id, slug, en, ja, region]) => ({ id, slug, en, ja, region })),
    cities,
    experiences,
  };
}
