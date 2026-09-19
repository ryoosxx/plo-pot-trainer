# Cursor に送るプロンプト集

使い方：Cursor の **Agent（Composer）モード** を開き、下のプロンプトを **上から 1 つずつ** 貼る。
1 プロンプト＝ 1 フェーズ。**前のプロンプトのテストが全部通ってから次へ進むこと。**
モデルは Claude Opus / Sonnet 系を推奨。

コツ:
- 毎回プロンプト冒頭で `@CLAUDE.md @docs/spec.md @docs/pot-limit-rules.md` を参照させる（Cursor の `@` でファイルを添付）。
- 「テストを先に書いて、通るまで直して」と明示すると精度が上がる。
- 生成後は必ず `npm run test` と `npm run typecheck` を自分で実行し、赤ければ「テストの出力を貼って直させる」。
- 一度に複数フェーズを頼まない。壊れたときに原因が特定できなくなる。

---

## Prompt 0 — プロジェクト初期化

```
@CLAUDE.md @docs/spec.md

このリポジトリに PLO Pot Trainer の土台を作ってください。まだ機能は作らず、雛形だけです。

1. Vite + React 18 + TypeScript(strict) のプロジェクトを、このディレクトリ直下に作成
2. Tailwind CSS v3 を導入し、docs/spec.md §7 のデザイントークン（背景/面/罫線/文字/アクセント/正解/不正解）を
   tailwind.config.js の theme.extend.colors に定義
3. zustand, react-router-dom, vitest, @testing-library/react, @testing-library/jest-dom,
   jsdom, eslint, prettier を導入
4. package.json に scripts を用意: dev / build / preview / test / test:watch / typecheck / lint / format
5. CLAUDE.md §3 のディレクトリ構成（src/domain, src/features, src/components/ui, src/store, src/lib）を
   空の index.ts と共に作成
6. ダークテーマ固定・モバイル幅基準の最小レイアウト（App.tsx にタイトルだけ表示）
7. .gitignore, README.md（セットアップ手順とコマンド一覧のみ）

制約:
- UI ライブラリ（MUI, shadcn 等）は入れない
- SSR/Next.js にしない。バックエンドは作らない
- tsconfig は strict: true, noUncheckedIndexedAccess: true

完了後、npm run dev と npm run test が動くことを確認し、実行したコマンドと結果を報告してください。
```

---

## Prompt 1 — 計算エンジン（Phase 1 の中核・最重要）

```
@CLAUDE.md @docs/spec.md @docs/pot-limit-rules.md

ポットリミット計算のドメイン層を実装してください。ここがアプリの心臓部なので、
テストファーストで進めてください。

手順:
1. src/domain/types.ts に docs/spec.md §4 の型をそのまま定義する
2. src/domain/potLimit.test.ts を先に書く。
   docs/pot-limit-rules.md の §3（PF-01〜PF-13）、§4（FL-01〜FL-06）、§5（MIN-01〜MIN-04）の
   表を it.each の表としてそのまま写経する。表の数値は絶対に変更しないこと。
   さらに §8 の不変条件のうち「maxRaiseTo === 3*C + (P - C - h)」を全ベクタで検証する
3. src/domain/potLimit.ts を実装してテストを通す
   - 公開 API は docs/spec.md §4.1 の通り
   - 実装する式は maxRaiseTo = h + P + 2*(C - h) のみ（P は「コール前の今の全額」）
   - スタックによる all-in クランプ、最初のベット（C=0）、アンティを含む potBefore を扱う
   - analyze() は ExplanationStep[] を 3 段（(1)ポット総額 (2)追加できる最大 (3)レイズ to）で返す
4. src/domain/chips.ts と chips.test.ts（rules §7 の CH-01〜CH-04）
5. diagnose(scenario, userAnswer) を実装。MistakeKind を判定する:
   - 自分の投入額を足し忘れ (forgot_own_investment): 答え - h と一致
   - コールを 2 倍し忘れ (forgot_double_call): P + toCall + h と一致
   - コール後のポットで計算 (used_pot_after_call): P + toCall と一致
   - ブラインド分ずれ (off_by_blind): 差が sb または bb と一致
   それぞれのテストも書く

制約:
- domain 配下では React / DOM / localStorage / Math.random を一切使わない
- 金額はすべて整数。浮動小数点演算をしない
- 計算式を書いてよいのは potLimit.ts だけ

最後に npm run test を実行し、全ベクタが通ったことを表で報告してください。
```

---

## Prompt 2 — 問題生成器（Lv1〜3）

```
@CLAUDE.md @docs/spec.md @docs/pot-limit-rules.md

Lv1〜Lv3 の問題生成器を実装してください。

1. src/domain/generator/rng.ts — シード付き RNG（mulberry32 など）。Math.random は使わない
2. src/domain/generator/index.ts
   - generateQuestion(level, settings, seed): Question を返す
   - 実装方針は docs/spec.md §5.1 の通り、必ず「合法なアクション列のシミュレーション」で局面を作る。
     乱数で数字を直接でっち上げない
   - Lv1: プリフロップ、ブラインドのみ or リンパー、ヒーローは未投入の席
     Lv2: ヒーローが SB / BB（すでに投入がある）
     Lv3: シングル／ダブルストラドルあり
3. src/domain/generator/validate.ts — validateScenario(scenario) が
   docs/pot-limit-rules.md §8 の不変条件 1〜4 を検査する
4. テスト:
   - 各レベルについて 10,000 問生成し、validateScenario が全件 true であること
   - 同じ seed で同じ問題が再現されること
   - 生成される局面のバリエーション（ヒーロー席・アクション数）が偏りすぎないこと

生成器は正解値を自分で計算せず、必ず domain/potLimit.ts の analyze() を呼んで answer を得ること。

npm run test の結果を報告してください。
```

---

## Prompt 3 — 出題画面（Phase 1 完成）

```
@CLAUDE.md @docs/spec.md

モード A（最大レイズ額クイズ）の画面を実装し、Phase 1 を完成させてください。
UI は docs/spec.md §3.2〜§3.5 のワイヤーフレームに従ってください。

1. ルーティング（react-router-dom）: / , /quiz/max-raise , /result/:sessionId
2. components/ui: NumericKeypad, AnswerDisplay, ProgressBar, PokerTable(SVG), ActionLog, FeedbackPanel
   - NumericKeypad は 0-9 / 00 / 削除 / 決定。タップ領域 56px 以上。OS キーボードは開かない
   - PokerTable は 6max の楕円テーブル。各席のチップ額、HERO 強調、D ボタンを表示。ロジックを持たない
3. features/quiz: useReducer で「現在の問題・入力値・経過時間・結果配列」を管理
   - 20 問で 1 セッション。1 問ごとに即時フィードバック（§3.4 の 3 ステップ表示）
   - 正誤判定は完全一致。誤答時は diagnose() のヒントを表示
   - 「次へ」は手動タップ（自動送りしない）
4. 結果画面: 正答率・平均解答時間・間違えた問題一覧・[もう一度][ホームへ]
5. ホーム画面: 主 CTA（最大レイズ額クイズ）と現在の設定サマリ。他モードは disabled で表示
6. テスト（@testing-library/react）: 出題 → キーパッド入力 → 決定 → フィードバック → 次問 → 結果集計 の 1 本

制約:
- 計算は必ず domain/potLimit.ts の analyze() 経由。コンポーネント内で数式を書かない
- 375px 幅で崩れないこと。ダークテーマ固定
- 文言は src/lib/strings.ts に集約（日本語）

npm run dev で動かし、iPhone サイズのビューポートでの見た目を確認して報告してください。
```

---

## Prompt 4 — Phase 2（実戦レベル・設定・統計）

```
@CLAUDE.md @docs/spec.md @docs/pot-limit-rules.md

Phase 2 を実装してください。

1. 生成器 Lv4（3bet/4bet）、Lv5（フロップ以降）、Lv6（アンティ・大きいレート・all-in クランプ）を追加。
   各レベル 10,000 問のプロパティテストを追加する
2. 設定画面 /settings — docs/spec.md §3.6 の表の全項目。zustand + persist で
   localStorage キー plo-trainer:settings:v1 に保存
3. 統計 /stats — §3.7 の内容。plo-trainer:sessions:v1 に直近 100 セッションを保存。
   チャートは自作の div ベースのバーで描く（ライブラリ追加禁止）
4. 学習ページ /learn — docs/pot-limit-rules.md §2 の公式と 3 ステップの覚え方を UI 化し、
   数値を変えると結果が変わるインタラクティブな例題を 1 つ置く
5. 永続化のバージョン検査。スキーマ不一致・JSON 破損時は初期化して UI に 1 回だけ通知する（例外を握り潰さない）

テスト: ストアの永続化と破損データからの復旧、レベル別の生成、統計集計のロジック。
```

---

## Prompt 5 — Phase 3（サイドポット・ポットカウント・チップ両替）

```
@CLAUDE.md @docs/spec.md @docs/pot-limit-rules.md

Phase 3 の 3 モードを実装してください。まず sidePot から、テストファーストで。

1. src/domain/sidePot.ts + テスト
   - buildPots(entries) を docs/pot-limit-rules.md §6 のアルゴリズムで実装
   - SP-01〜SP-04 のベクタを it.each で写経（値は変更禁止）
   - 追加のプロパティテスト: ポット総額 == 全投入額の合計（未コール返却分を除く）
2. モード D（サイドポット構築）の画面。各ポットの金額と参加者を答えさせる
3. モード B（ポット総額カウント）。アクションを 1 つずつ表示して最終ポットを答えさせる
4. モード C（チップ両替）。指定額の最小枚数分解と、チップの山の合計額を答える 2 種類
5. ホーム画面の副モードボタンを活性化

各モード 10 問完走できることを確認してください。
```

---

## Prompt 6 — Phase 4（PWA・仕上げ）

```
@CLAUDE.md @docs/spec.md

Phase 4 の仕上げをしてください。

1. vite-plugin-pwa を導入し、完全オフラインで動作させる（ホーム画面追加、アイコン、manifest）
2. 効果音（正解/不解答）と触覚フィードバック。設定でオフにできる
3. 苦手カテゴリの重み付け出題（正答率が低い / 平均解答時間が長いレベルを多めに出す）
4. 統計の CSV 書き出し
5. モード E（実戦シミュレーション）: ハンドが進行し、ランダムなタイミングで「Pot?」を問う

最後に、機内モード（devtools の offline）で起動して 1 セッション完走できることを確認してください。
```

---

## 補助プロンプト

### バグ報告のテンプレ

```
@CLAUDE.md @docs/pot-limit-rules.md

次の局面で答えが合いません。
レート: 1/2、ストリート: プリフロップ
アクション: UTG レイズ to 7 / MP コール / ヒーロー = BB
アプリの表示: 24 / 正しい答え: 29（docs/pot-limit-rules.md の PF-08）

1. 原因を特定して説明
2. この局面を再現する回帰テストを先に追加
3. 修正して全テストを通す
という順で対応してください。既存のベクタ表は変更しないこと。
```

### 実装レビュー用

```
@CLAUDE.md

直近の変更をレビューしてください。特に:
1. domain 以外の場所でポット計算の式が再実装されていないか（grep して確認）
2. 金額に浮動小数点や Math.random が混入していないか
3. docs/pot-limit-rules.md のベクタ表が改変されていないか（git diff で確認）
4. 375px 幅でのタップ領域が 44px を下回っていないか
問題があれば修正案を出してから直してください。
```

### 仕様変更時（ハウスルール対応など）

```
@CLAUDE.md @docs/pot-limit-rules.md

うちのルームでは <ここに実際のルールを書く> という運用です。
1. まず docs/pot-limit-rules.md にこのルールと検証ベクタを追記する（人間が確認するので提案として示す）
2. 承認後に実装とテストを更新する
の順でお願いします。先に実装しないでください。
```
