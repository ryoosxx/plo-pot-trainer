# PLO Pot Trainer 設計書

> 版: 1.0 / 対象: Phase 1〜4 / 前提: `CLAUDE.md` と `docs/pot-limit-rules.md` を読了していること

---

## 1. 要件

### 1.1 背景・課題
ポーカールームのディーラーは、PLO で「Pot?」と問われた瞬間に最大レイズ額を正確に即答する必要がある。
とくに **自分がすでにチップを出している席（SB / BB / ストラドル）** や **ポストフロップの再レイズ** で誤りやすい。
誤りはフロアコール・ゲーム進行の遅延・信用低下に直結する。

### 1.2 ゴール（成功指標）
- Lv1〜3 の問題を **平均 8 秒以内・正答率 95% 以上**
- Lv4〜6（3bet / ポストフロップ再レイズ / アンティ）で **正答率 90% 以上**
- 1 セッション（20 問）が 3〜5 分で完了し、片手で操作できる

### 1.3 スコープ外
ハンド強度・エクイティ・戦略、オンライン対戦、ユーザー登録、サーバー、課金、レーキ計算（将来検討）。

---

## 2. 機能一覧

| ID | モード | 内容 | フェーズ |
|---|---|---|---|
| A | 最大レイズ額クイズ | 局面を提示し、最大レイズ額（raise-to / 追加額）を答える。**中核機能** | 1–2 |
| B | ポット総額カウント | アクション列を順に提示し、最終ポット額を答える | 3 |
| C | チップ両替ドリル | 指定額を最小枚数で分解／チップの山の合計額を答える | 3 |
| D | サイドポット構築 | 複数 all-in からメイン／サイドポットと参加者を答える | 3 |
| E | 実戦シミュレーション | ハンドが流れ、ランダムなタイミングで「Pot?」を問われる | 4 |
| S | 設定 | レート、アンティ、ストラドル、出題レベル、問題数、額面、回答形式、効果音 | 2 |
| T | 統計・履歴 | 正答率、平均解答時間、レベル別成績、連続正解、直近の推移 | 2 |
| L | ルール学習 | 公式と例題の解説ページ（`pot-limit-rules.md` の内容を UI 化） | 2 |

---

## 3. 画面設計

### 3.1 画面遷移

```
ホーム(/) ──▶ 出題(/quiz/:mode) ──▶ 結果(/result/:sessionId)
   │                                     │
   ├──▶ 設定(/settings)                  └──▶ ホーム / もう一度
   ├──▶ 統計(/stats)
   └──▶ 学習(/learn)
```

ルーティングは URL ベース（react-router-dom）。ブラウザバックで出題を抜けた場合、
そのセッションは「中断」として保存し、統計には計上しない。

### 3.2 ホーム `/`

```
+------------------------------+
|  PLO Pot Trainer       [設定] |
|                              |
|  今日  12問 / 正答率 83%      |
|  連続正解 7                   |
|                              |
| +--------------------------+ |
| |  ▶ 最大レイズ額クイズ     | |  <- 主CTA（大きく）
| |    Lv1-3 / 20問 / 1-2     | |  <- 現在の設定サマリ
| +--------------------------+ |
|  [ポットカウント] [チップ]    |  <- 副モード（Phase 3 で活性）
|  [サイドポット]   [実戦]      |
|                              |
|  [統計]    [ルール学習]       |
+------------------------------+
```

### 3.3 出題（モード A）`/quiz/max-raise`

```
+------------------------------+
| <-  3/20            00:06    |  <- 進捗・経過時間（進捗バー）
+------------------------------+
|         [テーブル図]          |  <- 席とチップ、HERO強調、Dボタン
|      SB1  BB2  UTG:7         |
+------------------------------+
| アクション履歴                |
|  UTG レイズ to 7             |
|  MP  コール 7                |
|  -> HERO(BB) の最大レイズは？ |  <- 設問文（回答形式で文言が変わる）
+------------------------------+
|          [   29   ]          |  <- 入力表示（大きい数字・右寄せ）
|    +---+---+---+             |
|    | 7 | 8 | 9 |             |
|    +---+---+---+             |  <- 独自テンキー（親指到達域）
|    | 4 | 5 | 6 |             |
|    +---+---+---+             |
|    | 1 | 2 | 3 |             |
|    +---+---+---+             |
|    | 0 |00 | ← |             |
|    +---+---+---+             |
|    [       決定       ]      |
+------------------------------+
```

- 設問文は設定 `answerType` により切替：
  - `raiseTo` → 「最大でいくらまで **レイズできる**か（合計額）」
  - `addChips` → 「最大で **いくら出せる**か（追加額）」
  - `both` → 2 段入力（追加額 → 合計額）
- 数値入力は独自キーパッドのみ（OS のキーボードを開かない）。`00` キーで大きい額を素早く入力。
- 制限時間はデフォルト無し。設定でオンにできる（超過しても回答は可能。記録に「時間超過」フラグ）。

### 3.4 即時フィードバック（出題画面の下部にスライドイン）

正解時：

```
[正解]  29                (4.8秒)
  ポット 17 ＋ コール 5×2 = 27（追加）
  ＋ 自分の 2 → レイズ to 29
                        [ 次へ ▶ ]
```

不正解時：

```
[不正解]  あなた: 27 / 正解: 29
  (1) 今のポット総額 = 1+2+7+7 = 17
  (2) 追加できる最大 = 17 + (5×2) = 27
  (3) レイズ to = 27 + 自分の 2 = 29
  ヒント: 自分がすでに出した BB の 2 を足し忘れています
                        [ 次へ ▶ ]
```

- **説明は必ず 3 ステップ固定**（(1) ポット総額 → (2) 追加最大 → (3) 合計）。
  domain が返す `ExplanationStep[]` をそのまま描画し、UI 側で式を組み立て直さない。
- 典型的誤答（自分の投入分の足し忘れ／コール額を 2 倍し忘れ／トレイル漏れ）を診断してヒント文を出す（`diagnose()`）。
- 「次へ」は自動送りしない（自分のペースで読ませる）。ただし正解時のみ 1.2 秒で自動送りする設定を用意。

### 3.5 結果 `/result/:sessionId`

正答率の大きな数字、平均解答時間、レベル別の内訳バー、間違えた問題の一覧（タップで局面を再表示して復習）、
[もう一度] [苦手だけ復習] [ホームへ]。

### 3.6 設定 `/settings`

| 項目 | 既定値 | 選択肢 |
|---|---|---|
| レート (SB/BB) | 1 / 2 | 1/2, 1/3, 2/5, 5/5, 100/200, 200/400, 500/1000, カスタム |
| アンティ | なし | なし / BB アンティ / 全員アンティ（額を指定） |
| ストラドル出題 | あり | なし / シングル / ダブルまで |
| 出題レベル | Lv1–3 | Lv1〜Lv6 の複数選択 |
| 問題数 | 20 | 10 / 20 / 50 / 無限 |
| 回答形式 | raiseTo | raiseTo / addChips / both |
| 制限時間 | なし | なし / 10 秒 / 15 秒 / 20 秒 |
| チップ額面 | 100/500/1000/5000/10000 | 日本式 / US式 / カスタム |
| 効果音・バイブ | オン | オン / オフ |
| 統計リセット | — | 確認ダイアログ付き |

### 3.7 統計 `/stats`

累計問題数・正答率・平均解答時間、レベル別の正答率と平均時間の表、直近 14 日の推移
（軽量な自作バーチャート。チャートライブラリは導入しない）、最高連続正解記録、苦手カテゴリ Top3。

### 3.8 学習 `/learn`

`docs/pot-limit-rules.md` の §2（公式・3 ステップの覚え方）を UI 化。
数値を差し替えて結果が変わるインタラクティブな例題を 1 つ置く。

---

## 4. ドメインモデル

```ts
// src/domain/types.ts
export type Chips = number;                    // 常に整数（最小チップ単位）
export type SeatId = 'SB'|'BB'|'STR'|'UTG'|'UTG1'|'MP'|'LJ'|'HJ'|'CO'|'BTN';
export type Street = 'preflop'|'flop'|'turn'|'river';
export type Level = 1|2|3|4|5|6;

export interface Stake { sb: Chips; bb: Chips; ante: Chips; anteType: 'none'|'bb'|'all'; unit: Chips; }

export interface Seat {
  id: SeatId;
  label: string;          // 表示名
  stack: Chips;           // 当該ストリート開始時点の残り
  folded: boolean;
  isHero: boolean;
  isButton: boolean;
}

export interface Scenario {
  street: Street;
  seats: Seat[];
  potBefore: Chips;                         // 前ストリートまでの確定ポット＋アンティ
  contributions: Partial<Record<SeatId, Chips>>;   // 当該ストリートの投入額
  heroSeat: SeatId;
  actionLog: ActionEntry[];                 // 表示用。計算には使わない
  stake: Stake;
}

export interface ActionEntry {
  seat: SeatId;
  type: 'ante'|'post'|'straddle'|'fold'|'check'|'call'|'bet'|'raise';
  amountTo?: Chips;                         // raise/bet は "to" の額
}

export interface PotLimitResult {
  totalPot: Chips;        // P
  currentBet: Chips;      // C
  heroInvested: Chips;    // h
  toCall: Chips;
  trail: Chips;
  maxRaiseTo: Chips;
  maxAddChips: Chips;
  minRaiseTo: Chips;
  isAllIn: boolean;       // スタック上限でクランプされたか
  steps: ExplanationStep[];
}

export interface ExplanationStep { label: string; expression: string; value: Chips; }
```

### 4.1 domain の公開 API

```ts
// src/domain/potLimit.ts
export function analyze(s: Scenario): PotLimitResult;   // 唯一の計算入口
export function totalPot(s: Scenario): Chips;
export function currentBet(s: Scenario): Chips;
export function toCall(s: Scenario): Chips;
export function maxRaiseTo(s: Scenario): Chips;
export function minRaiseTo(s: Scenario): Chips;
export function diagnose(s: Scenario, userAnswer: Chips): MistakeKind | null;

// src/domain/sidePot.ts
export function buildPots(entries: { seat: SeatId; amount: Chips; folded: boolean }[]): Pot[];

// src/domain/chips.ts
export function breakdown(amount: Chips, denoms: Chips[]): { denom: Chips; count: number }[];
export function totalOf(stacks: { denom: Chips; count: number }[]): Chips;
```

`MistakeKind` は
`'forgot_own_investment' | 'forgot_double_call' | 'used_pot_after_call' | 'missed_trail' | 'off_by_blind' | 'unknown'`。
フィードバックのヒント文はこの種別ごとに固定文言を持つ。

---

## 5. 問題生成器

### 5.1 方針
**乱数で数字をでっち上げない。** シード付き RNG で「合法なアクション列」をシミュレートし、その途中局面を問題にする。

```
1. 設定（レート・アンティ・人数）から初期状態を作る（アンティ／ブラインド／ストラドルを post）
2. レベルに応じてアクション回数を決める
3. 各アクションで、そのプレイヤーの合法手（fold / call / raise[min..max]）から選ぶ
   - レイズ額は「ポットレイズ / ミニレイズ / その中間のキリの良い額」から選ぶ（実戦的な分布）
4. ヒーローの手番で停止 → その局面を Scenario として出力
5. validateScenario() で不変条件（docs/pot-limit-rules.md §8）を検査。違反したら破棄して再生成
```

### 5.2 レベル定義

| Lv | 内容 | ヒーローの投入 | 対応ベクタ |
|---|---|---|---|
| 1 | プリフロップ、ブラインドのみ or リンパー、ヒーローは後方席 | なし | PF-01, PF-02 |
| 2 | プリフロップ、ヒーローが SB / BB（自分の投入あり） | あり | PF-03, PF-07, PF-09 |
| 3 | ストラドル（シングル／ダブル）あり | あり／なし | PF-04〜PF-06, PF-13 |
| 4 | プリフロップ 3bet / 4bet | あり | PF-10 |
| 5 | フロップ以降（ベット・レイズ・複数コーラー） | あり／なし | FL-01〜FL-05 |
| 6 | アンティ、大きいレート、スタック上限による all-in クランプ | 混在 | PF-11, PF-12, FL-06 |

### 5.3 数値の作り方
- 額はすべて最小チップ単位の倍数。
- レート 1/2 系は素の数字、100/200 系は 3 桁以上になるため `00` キーが効く。
- 同一セッション内で同じ局面を出さない（直近 30 問のシナリオハッシュを保持）。

---

## 6. 状態管理・永続化

### 6.1 zustand ストア

- `useSettingsStore` — 設定（`persist` ミドルウェアで localStorage 同期）
- `useStatsStore` — セッション履歴・集計（localStorage 同期、直近 100 セッション保持）
- 出題中の状態（現在の問題・入力値・経過時間）は **quiz feature 内の `useReducer`**。グローバルに置かない。

### 6.2 localStorage スキーマ

| キー | 内容 |
|---|---|
| `plo-trainer:settings:v1` | `Settings` |
| `plo-trainer:sessions:v1` | `SessionResult[]`（新しい順、最大 100） |
| `plo-trainer:meta:v1` | `{ schemaVersion, bestStreak, currentStreak }` |

読み込み時にスキーマバージョンを検査する。不一致・破損時は **握り潰さず初期化し、UI に 1 回だけ通知**する。

```ts
interface AnswerRecord {
  questionId: string; seed: number; level: Level; mode: Mode;
  answer: Chips; input: Chips; correct: boolean;
  elapsedMs: number; timedOut: boolean;
  mistake: MistakeKind | null; at: string;   // ISO8601
}

interface SessionResult {
  id: string; mode: Mode; startedAt: string; endedAt: string;
  completed: boolean; records: AnswerRecord[]; settingsSnapshot: Settings;
}
```

---

## 7. UI コンポーネント

| コンポーネント | 責務 |
|---|---|
| `PokerTable` | 楕円テーブルと席の描画（SVG）。チップ額・HERO 強調・D ボタン。ロジックを持たない |
| `ActionLog` | アクション履歴のリスト表示 |
| `NumericKeypad` | 0-9 / 00 / ← / 決定。タップ領域 56px 以上、押下時に軽い触覚フィードバック |
| `AnswerDisplay` | 入力中の数値を大きく表示（桁区切り） |
| `FeedbackPanel` | 正誤・正解値・3 ステップの説明・ヒント |
| `ProgressBar` | 進捗と経過時間 |
| `StatBar` | 統計画面の自作バー（外部依存なし） |

**デザイントークン**（Tailwind の theme に定義する）

- 背景 `#0B1220` / 面 `#141C2B` / 罫線 `#26314A`
- 文字 `#E8EDF7` / サブ文字 `#93A1BD`
- アクセント（フェルトグリーン）`#1FA37A` / 正解 `#22C55E` / 不正解 `#EF4444` / 注意 `#F59E0B`
- 数字は `tabular-nums`。回答表示は 40px 以上、設問文は 16px 以上
- タップ対象は最小 44×44px。正誤は「色 ＋ アイコン ＋ 文言」の 3 重で表現する（色だけに依存しない）

---

## 8. 非機能要件

- 初回ロード 200KB（gzip）以内、Lighthouse Performance 90 以上
- 完全オフライン動作（Phase 4 の PWA 化以降）。通信は一切行わない
- アカウント・個人情報を持たない。データは端末内のみ
- 対応: iOS Safari 16+ / Android Chrome 最新 / デスクトップ Chrome・Edge・Safari
- 縦向きを基準とし、横向きでも破綻しないこと

---

## 9. テスト方針

| 層 | 手段 | 基準 |
|---|---|---|
| domain | Vitest。`docs/pot-limit-rules.md` の表を `it.each` に写経 | 全ベクタ一致・分岐網羅 |
| 生成器 | プロパティテスト（10,000 ケース） | 不変条件違反 0 件 |
| ストア | Vitest | 永続化と、破損データからの復旧 |
| UI | @testing-library/react | 出題→回答→フィードバック→次問 の一連の流れ／キーパッド入力／結果集計 |

`npm run test` / `npm run typecheck` / `npm run lint` が CI（GitHub Actions、Phase 2 以降）で緑であること。

---

## 10. 実装フェーズと受け入れ条件

### Phase 1 — 計算エンジン ＋ 最小クイズ
- `domain/types.ts` `domain/potLimit.ts` `domain/chips.ts` と全テスト（rules §3〜§5 のベクタ）
- 生成器 Lv1–3、モード A の出題画面・フィードバック・結果画面
- **受け入れ**: 20 問を通しで解けて、正答率が結果画面に出る。全テスト green。

### Phase 2 — 実戦レベル ＋ 設定 ＋ 統計
- 生成器 Lv4–6、設定画面（全項目）、統計・履歴、学習ページ、誤答診断 `diagnose()`
- **受け入れ**: レート・レベルを変えると出題が変わり、統計が端末再起動後も残る。

### Phase 3 — 周辺モード
- モード B（ポットカウント）／C（チップ両替）／D（サイドポット。`sidePot.ts` ＋ テスト）
- **受け入れ**: 各モードが単独で 10 問完走でき、SP / CH ベクタのテストが green。

### Phase 4 — 仕上げ
- PWA（オフライン・ホーム画面追加）、効果音・触覚、モード E（実戦シミュレーション）、
  苦手カテゴリの重み付け出題、統計の CSV 書き出し
- **受け入れ**: 機内モードで起動して 1 セッション完走できる。
