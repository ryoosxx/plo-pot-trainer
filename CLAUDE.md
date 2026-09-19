# CLAUDE.md — PLO Pot Trainer

ポーカーディーラー向け「PLO（ポットリミット・オマハ）のポット計算」練習 Web アプリ。
このファイルはプロジェクトの憲法。AI エージェント（Claude Code / Cursor）は作業前に必ず本ファイルと
`docs/pot-limit-rules.md` を読むこと。

---

## 1. プロダクト概要

- **利用者**: ポーカールームの現役ディーラー（本プロジェクトのオーナー）。実戦でのポット計算の速度と正確性を上げたい。
- **利用シーン**: 休憩中・出勤前にスマートフォンで 3〜10 分の反復ドリル。片手・親指操作。
- **中核価値**: 「ポットは？」と聞かれた瞬間に **最大レイズ額（raise-to）** を即答できるようになること。
- **非目標**: ハンドの強さ判定、エクイティ計算、GTO 戦略、オンライン対戦、課金。

## 2. 技術スタック（変更禁止・追加は要相談）

| 項目 | 採用 |
|---|---|
| ビルド | Vite |
| 言語 | TypeScript（`strict: true`、`any` 禁止） |
| UI | React 18（関数コンポーネント + Hooks のみ） |
| スタイル | Tailwind CSS v3（独自 CSS ファイルは原則作らない） |
| 状態管理 | zustand（グローバルは設定・統計のみ。出題状態はローカル state） |
| テスト | Vitest（ドメイン層）+ @testing-library/react（主要画面のみ） |
| 永続化 | localStorage のみ（**バックエンド・DB・外部 API は使わない**） |
| デプロイ | 静的ホスティング（Vercel / GitHub Pages）。SSR 不使用 |

- パッケージ追加は「Tailwind / zustand / vitest / vite-plugin-pwa」以外は事前に理由を提示すること。
- UI ライブラリ（MUI, shadcn 等）は導入しない。素の Tailwind で作る。

## 3. アーキテクチャの鉄則

```
src/
  domain/          # 純粋 TypeScript。React・DOM・localStorage を import しない
    types.ts
    potLimit.ts    # ポットリミット計算の唯一の実装
    sidePot.ts
    chips.ts
    generator/     # 問題生成（合法アクションのシミュレーションで作る）
  features/
    quiz/ stats/ settings/ rules/
  components/ui/   # 汎用の見た目部品（ロジックを持たない）
  store/           # zustand ストア
  lib/             # フォーマッタ等の小道具
```

**絶対規則**

1. **計算式は `src/domain/potLimit.ts` にのみ書く。** コンポーネントや問題生成側で `pot * 2 + ...` のような
   再実装を書いた時点でバグ。必ず domain の関数を呼ぶ。
2. `domain/` は副作用ゼロ・同期・決定的。乱数は `domain/generator/rng.ts` のシード付き RNG のみ使用（`Math.random()` 直呼び禁止）。
3. **金額はすべて整数（最小チップ単位 = 1）で保持する。** 浮動小数点で金額を扱わない。0.5 単位が必要なレートは
   内部で 2 倍などにスケールし、表示時に戻す。
4. 問題は「乱数で数字をでっち上げる」のではなく、**合法なアクション列をシミュレートして生成する**。
   生成された局面は必ず「min-raise ≤ 各レイズ ≤ max-raise」を満たすこと。生成後に検証関数で自己チェックする。
5. UI 文言は `src/lib/strings.ts` に集約（将来の英語対応のため）。デフォルト言語は日本語。

## 4. ドメイン用語（コード上の命名を統一する）

| 用語 | 意味 | 変数名 |
|---|---|---|
| potBefore | 当該ストリート開始時点で確定しているポット（前ストリートまで＋アンティ） | `potBefore` |
| contribution | 当該ストリートで各席が出した累計額 | `contributions` |
| currentBet (C) | 当該ストリートの最大 contribution（コールすべき水準） | `currentBet` |
| heroInvested (h) | ヒーローの当該ストリート contribution | `heroInvested` |
| toCall | `C - h` | `toCall` |
| totalPot (P) | `potBefore + Σcontributions`（＝今テーブル上にある全額） | `totalPot` |
| raise-to | レイズ後のヒーローの当該ストリート合計額（announce する数字） | `maxRaiseTo` |
| trail | `P - C - h`（最終ベットと自分の投入を除いた残りのポット） | `trail` |

## 5. 核心の計算式（詳細と検証データは `docs/pot-limit-rules.md`）

**実装すべき唯一の式：**

```ts
maxRaiseTo = h + totalPot + 2 * toCall           //  = 3*C + trail  と恒等
maxAddChips = maxRaiseTo - h                     //  実際にヒーローが今出すチップ量
```

- 最初のベット（C = 0, h = 0）のとき `maxRaiseTo = totalPot`。
- ヒーローのスタック上限がある場合は `min(maxRaiseTo, h + heroStack)` にクランプする。
- `3 × 現在のベット額 + trail` は暗算用ショートカット。**同じ値になることを必ずテストで固定する。**

## 6. コーディング規約

- 命名は英語、コメントは日本語可。ドメイン用語は §4 の表に従う。
- 関数は「1 つのことをする」。domain の公開関数には JSDoc で式と 1 例を書く。
- マジックナンバー禁止。ブラインド・アンティ・チップ額面は設定オブジェクト経由。
- `src/domain/**` の変更時は **必ず対応する Vitest を同時に追加/更新する**。
- テストは `docs/pot-limit-rules.md` の検証ベクタ表を「そのまま `it.each` の表」として写経すること。
  表の値を変更してはならない（変更したい場合は人間に確認を取る）。

## 7. UI 原則

- **モバイルファースト**（375px 幅を基準、片手・親指到達域に数値キーパッド）。
- ダークテーマ固定。ポーカールームの薄暗い環境向けに高コントラスト・大きな数字。
- 回答は自作の数値キーパッド（OS のキーボードを出さない。`inputMode` ではなく独自ボタン）。
- 1 問の目標解答時間 10 秒。タイマーは表示するが、時間切れで強制終了はしない（ストレスを与えない）。
- フィードバックは即時。正解／不正解に加えて**必ず計算過程を 3 行以内で表示**する。
- アニメーションは最小限（150ms 以内）。連打で崩れないこと。

## 8. 品質基準（完了の定義）

- `npm run typecheck` / `npm run lint` / `npm run test` がすべてグリーン。
- `src/domain/potLimit.ts` と `sidePot.ts` は分岐網羅に近いテストがある。
- 問題生成器を 10,000 回まわして、不正局面（min/max 違反、負のポット、非整数）が 0 件であるテストがある。
- 375×667 と 1280×800 の両方でレイアウト崩れがない。

## 9. 開発フェーズ（この順序で実装する）

1. **Phase 1**: ドメイン層（potLimit / chips / 型）+ テスト + モード A（最大レイズクイズ Lv1–3）の最小画面。
2. **Phase 2**: 問題生成器の Lv4–6（3bet、ポストフロップ、アンティ、ストラドル）、設定画面、統計・履歴。
3. **Phase 3**: モード B（ポット総額カウント）、モード C（チップ両替）、モード D（サイドポット）。
4. **Phase 4**: PWA 化（オフライン）、効果音、実戦シミュレーション（モード E）、苦手カテゴリ重み付け出題。

各フェーズは「テストが通り、ブラウザで触れる状態」で必ず区切る。フェーズをまたいだ先行実装をしない。

## 10. 参照ドキュメント

- `docs/spec.md` — 画面・データモデル・機能の詳細設計書
- `docs/pot-limit-rules.md` — ルール、公式、**検証ベクタ表（テストの正）**
- `docs/cursor-prompts.md` — Cursor に貼るプロンプト集
