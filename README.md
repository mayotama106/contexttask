# ContextTask (LifeQuest)

`docs/design_handoff_contexttask/` のデザインハンドオフを実装したもの。プロトタイプ HTML は流用せず、トークン CSS のみをそのまま取り込んでいる。

## スタック選定

プロジェクトが空だったため以下を選定した。

| | 採用 | 理由 |
|---|---|---|
| フレームワーク | React 18 + TypeScript + Vite | モバイル / デスクトップ両ダッシュボードを 1 コードベースで賄える。ハンドオフのトークンが CSS カスタムプロパティなので、`tokens/*.css` を無改変で使える |
| 状態管理 | Zustand | 入力パスに await を挟まない同期的な store 更新が書ける |
| ローカル DB | Dexie (IndexedDB) | ブラウザ / PWA でのローカルファースト永続化。SQLite 相当の役割 |
| アイコン | lucide-react | ハンドオフ指定の Lucide をそのまま |
| モバイル | Capacitor 8 (iOS) | **iPhone がメイン端末**。上の Web 実装をそのまま WKWebView に載せられる |

```bash
npm run dev        # Vite 開発サーバー (port 5183)
npm run build      # 型検査 + 本番ビルド
npm run ios:open   # ビルド → cap sync → Xcode で開く
```

## 配信 (PWA / GitHub Pages)

**https://mayotama106.github.io/contexttask/**

iPhone の Safari で開き、共有 → 「ホーム画面に追加」で全画面起動の PWA になる。

- `main` への push で GitHub Actions が自動デプロイ（[.github/workflows/pages.yml](.github/workflows/pages.yml)）
- Pages は `/<repo>/` 配下で配信されるため、ワークフローが `VITE_BASE` を渡す。Capacitor は WebView のルートから読むので既定の `/` のまま。**同じコードから両方が出る**
- Service Worker (vite-plugin-pwa) が全アセットを precache。2 回目以降は機内モードでも起動する
- トークンのフォントは Google Fonts なので precache が届かない。初回ロード時に CacheFirst で拾い、オフラインでも Deep Mist の書体を保つ
- アイコンは `npm run icon` で iOS 用 1024px と PWA 用 192/512/180/32px をまとめて生成する

### バックエンドは無い

サーバもデータベースも API 呼び出しも持たない。タスクは閲覧者自身の端末の IndexedDB にのみ保存され、どこにも送信されない。GitHub Pages は静的ファイルを配るだけ。

## iOS ネイティブシェル (Capacitor)

### Xcode でのビルド

`ios/` に Xcode プロジェクトを生成済み（Capacitor 8 は SwiftPM を使うので CocoaPods 不要）。

Xcode 16.2 / iOS 18.2 SDK でビルドとシミュレータ起動を確認済み。実機向け arm64 ビルドも（署名を除いて）成功を確認済み。

```bash
npm run ios:open   # ビルド → sync → Xcode で開く
npm run ios:run    # ビルド → sync → 実行先を選んで起動
```

Web 側を変更したら都度 `npm run ios:sync` が必要（`dist/` を `ios/App/App/public/` にコピーする）。

### 実機で動かす

署名だけは Apple ID が要るため手作業。初回のみ:

1. iPhone を USB 接続し、iPhone 側で「このコンピュータを信頼」
2. iPhone: 設定 → プライバシーとセキュリティ → **デベロッパモード** をオン → 再起動（iOS 16 以降で必須）
3. `npm run ios:open` → Xcode の App ターゲット → Signing & Capabilities → **Team** に自分の Apple ID を選択（無料の Personal Team で可）
   - Personal Team で bundle ID が衝突したら `app.lifequest.contexttask` を一意な値に変更する
4. Xcode の実行先を iPhone にして ⌘R
5. 初回起動時 iPhone: 設定 → 一般 → VPN とデバイス管理 → デベロッパ App → 開発者を信頼

注意点:

- 無料アカウントのプロビジョニングは **7 日で失効** する。切れたら再ビルドして入れ直す
- アプリは `dist/` をバンドルして動くので、実機で開発サーバーへの接続は不要（機内モードでも起動する）
- アイコンは `npm run icon` で再生成できる。ハンドオフにロゴが無かったため、ブランドの ✕ モチーフ + Deep Mist グラデーションによる**暫定**。正式なマークができたら差し替える

**@capacitor/status-bar と @capacitor/splash-screen は使っていない。** 現行の安定版（8.0.3 / 8.0.2）が core 8.5.0 の Swift API 変更（`PluginConfig.getString` の廃止、`UIColor(fromHex:)` → `argb:`）に追随しておらずコンパイルが通らないため。どちらも装飾用途だったので、宣言的な設定に置き換えた:

- ステータスバーの文字色 → `Info.plist` の `UIStatusBarStyle` / `UIViewControllerBasedStatusBarAppearance`
- 起動時の白フラッシュ回避 → `LaunchScreen.storyboard` の背景を `#08080f` に変更し、既定の白い Splash 画像を外した

対応版が出たら再導入してよい。

ネイティブ向けの調整:

- ステータスバーはハンドオフの偽物（9:41 + 電波アイコン）をやめ、iOS が描く実物の下に 44px / セーフエリア分のインセットだけ確保
- `Keyboard.resize: "native"` で WebView を縮め、キーボード表示時も Capture Dock が上に乗る（`100dvh` が可視領域に追従する）
- タップハイライト / 長押しメニュー / テキスト選択を抑止。入力欄だけは選択可能に戻している
- `isNative()` のとき画面幅によらずモバイルダッシュボードを描画
- iPhone は縦向き固定（横向きのデザインが無く、高さ ~390px では Capture Dock が破綻するため）

## デザイントークン

`src/styles/tokens/` はハンドオフからの**無改変コピー**。値の丸めも 8px グリッドへの再整列も行っていない。
コンポーネントの寸法（44px 高ヒーロー、50px 入力、26px チップ、224px レール等）もハンドオフ記載値をそのまま使用。

唯一の意図的な逸脱: セグメントタブ (`.ds-tab`) はデザインシステム既定の 32px だが、モバイル幅 (<900px) では `min-height: 44px` に拡張している。タップ領域 44px の要件を満たすため。ヒットエリアのオーバーレイではなくコントロール自体を拡げているのは、上のヒーロー / 下のタスクカードからタップを奪わないため。

## 構成

```
src/
  components/ds.tsx, ds.css   デザインシステム再実装
                              Button / IconButton / Input / Checkbox / Tag /
                              Badge / Card / Tabs / Toast / Switch
  lib/
    db.ts                     Dexie スキーマ + write-through ヘルパ
    parse.ts                  #tag ~est !due のライブ構文解析
    types.ts, useClock.ts
  features/
    capture/CaptureDock.tsx   画面下部固定のキャプチャ（最優先機能）
    capture/aiTagger.ts       AI タグ付けの Tagger インターフェース + 実装
    tasks/store.ts            タスク store + バックグラウンドジョブキュー
    tasks/TaskLine.tsx
    sync/obsidianSync.ts      Obsidian 同期コネクタ + 観測可能ステータス
    activity/store.ts         AI アクティビティのフィード
  screens/                    MobileDashboard / DesktopDashboard
```

`App.tsx` が `(min-width: 900px)` でデスクトップ / モバイルを切り替える。

## データ層の設計

### 保存は同期、AI は非同期

`store.capture()` の順序が仕様そのもの:

1. Zustand state を更新（UI はこのフレームで反映される）
2. Dexie へ書き込み — **await しない** (`writeThrough`)
3. AI ジョブを enqueue

送信ハンドラの同期コストは実測 **0.5ms**。オフラインでも 1 と 2 は完全に同じ経路を通る。

### AI タグ付け

`Tagger` インターフェース (`src/features/capture/aiTagger.ts`) の背後に 2 実装がある。

| 実装 | 使われる条件 |
|---|---|
| `ClaudeTagger` | 設定画面で API キーが登録されているとき |
| `HeuristicTagger` | キー未設定。キーワード照合のローカル推定 |

**キーは利用者自身のもの（BYOK）で、この端末の IndexedDB にのみ保存される。** バンドルにもリポジトリにも載らず、公開 URL を他人が開いてもその人の空の DB が見えるだけ。だから中継サーバなしでブラウザから直接 API を叩ける。

- モデルは `claude-haiku-4-5`（$1/$5 per MTok）。統制語彙への短い分類なので最安で足りる
- `output_config.format` の JSON スキーマで語彙・見積もり・確信度を制約するため、応答のパース処理が要らない
- Haiku 4.5 は `effort` を受け付けないので指定しない。分類に thinking は不要なので `thinking` も省略
- 設定画面にセッション中のトークン数と概算費用を表示する

**ブラウザから叩くには専用ヘッダが要る。** SDK を `dangerouslyAllowBrowser: true` で生成すると自動で付く。手書きの `fetch` で付け忘れると CORS で `Failed to fetch` になる（実測確認済み）。

**キーは暗号化していない。** ページのスクリプトが復号できる鍵は、ページに侵入したスクリプトも復号できるので意味がない。防御は Anthropic 側で行う — キーのスコープを絞り、Console で使用上限を設定する。

キューの性質:

- ジョブは Dexie に永続化されるため、リロード / クラッシュ / オフラインをまたいで再開する
- 指数バックオフで最大 3 回リトライ、以降 `aiStatus: "error"`
- **恒久エラーはリトライしない。** キーの拒否・権限不足・リクエスト拒否は `PermanentTaggerError` として即座に打ち切る。そうしないと誤ったキーがタスク 1 件ごとにリトライ枠を使い切る
- ユーザーが `#tag` を明示した場合は AI を起動しない（`tagSource: "user"` が優先）
- 未解決タグは ice グロー (`--ice-400` + `--glow-ice`) で表示。スピナーは一切使わない — ice はハンドオフ上「focus / active / AI 処理中」専用の色
- UNDO / 一時停止時は AbortController で中断し、ジョブはキューに残す

### Obsidian 同期 — GitHub 経由

**vault を GitHub リポジトリに置き、そこへ Markdown を書き出す。** ローカルのファイルシステムに触らないので、iPhone から動く唯一の経路。

ローカル vault への直接書き込みが選べない理由:

- PWA / WebView からは iOS・Android どちらもローカルフォルダに書けない（File System Access API はデスクトップ Chrome 系専用）
- Obsidian の Local REST API プラグインは `isDesktopOnly: true`。iPhone の Obsidian では起動せず、叩くべきエンドポイントが存在しない
- 仮に動いても、HTTPS ページから `http://127.0.0.1` は mixed content で遮断され、`https://127.0.0.1` は自己署名証明書を iOS Safari で信頼できない

実装は [githubVault.ts](src/features/sync/githubVault.ts):

- **Git Data API を使い、1 回の同期を 1 コミットにまとめる。** Contents API だとファイル数だけコミットが増える
- 削除は `.contexttask-manifest.json`（自分が書いたノートの一覧）に載っているものだけ。同じフォルダの手書きノートは対象外
- tree の sha が変わらなければ空コミットを作らずに終了する
- fine-grained PAT の `Contents: Read and write` だけで足りる。接続時にリポジトリ情報を取得し、**公開リポジトリなら警告を出す**（タスク内容が公開されるため）

Mac 側は obsidian-git などでこのリポジトリを取り込む。

UI とシームは仕様どおり:

- `useSyncStore` が `SyncStatus { state, lastSyncedAt, pending, error }` を公開。state は `synced | syncing | error | offline | disconnected`
- アダプタ未指定のとき `disconnected` に落ち着き、ヘッダは「Vault 未接続 · ローカルに保存済み」+ 中立グレーのドットを表示する。同期していないのに緑を出さない
- ドット色: 緑=同期済み / ice=同期中 / 赤=エラー / 金=オフライン / グレー=未接続

別の同期先を足すときは `VaultAdapter`（`push(tasks)` 1メソッド）を実装して `setVaultAdapter()` に渡す。デバウンス 1.2s・オフライン時のキュー保持・`online` での自動再開といったコネクタ側の機構はそのまま使える。

## タスクの編集・削除・バックアップ

タスク行（チェックボックス以外）をタップすると編集シートが開く。モバイルはボトムシート、640px 以上では中央ダイアログ。

- タイトル / タグ / 見積もり / 重要フラグを編集できる。タグは統制語彙のチップから選べる
- 編集すると `tagSource: "user"` になり、実行中の推論は中断される（AI が上書きし返さないようにするため）
- 削除は 2 段階確認。トーストの UNDO が「直前のキャプチャ 1 件」しか戻せないのに対し、こちらは恒久削除

設定タブ（[SettingsScreen.tsx](src/screens/SettingsScreen.tsx)）にバックアップを置いた。**このアプリはサーバを持たないため、書き出しが唯一のデータの逃し先になる。**

- 書き出し: `contexttask-YYYYMMDD-HHMM.json`（スキーマ版番号つき）
- 読み込みは**統合**であって上書きではない。id で upsert し、`updatedAt` が新しい方が残る。既存タスクを消さないので、復旧にも追加にも使える
- 読み込んだ JSON は全フィールドを検証・強制変換する（[backup.ts](src/lib/backup.ts)）。壊れたファイルでストアを壊さない
- 「すべて削除」はデモデータの再出現も止める（`seeded` フラグを立てる）

## 画面

| 画面 | 内容 |
|---|---|
| ホーム | TODAY ヒーロー + フォーカス/すべて + タスク一覧（ハンドオフ仕様の画面） |
| 今日 | 超過 / 今日 / 重要かつ日付なし の 3 グループ |
| タグ | タグ別の分布バー、タップでそのタグのタスクに絞り込み |
| 予定 | 期限が明日以降のタスクを日付ごとに（デスクトップのみ） |
| 設定 | バックアップ、AI トグル、全消去 |

デスクトップは左レールから同じ画面へ、`今日/今週/今月` タブはフォーカス一覧を期限で絞り込む。日付を持たないタスクはどの期間でも表示される（日付が無いものは「期間の外」ではないため）。

### 期限の解決

`!今日` `!金曜` `!8/14` のような自由入力を実日付に解決して `dueAt` に保存する（[due.ts](src/lib/due.ts)）。ユーザーが打った文字列は `due` にそのまま残す。

対応: 今日/明日/明後日/来週、曜日（漢字・英語・略記）、週末、N日後・N週間後、M/D、YYYY/M/D、D日。過ぎた M/D は翌年、過ぎた D日 は翌月に送る。2/31 のような存在しない日は null。

Dexie は v2 で `dueAt` インデックスを追加し、既存行は `due` 文字列から再解決して埋める。相対語はタスク自身の作成時刻を基準に解釈する（今日ではなく）。

### 重要フラグ — ハンドオフからの意図的な逸脱

ハンドオフは「`!期限` トークンがあれば `important: true`」と定めていた。期限が飾りだった頃は妥当だったが、期限が今日画面を駆動するようになると「重要 = 日付があるもの全部」になり、シグナルとして死ぬ。

そこで **`!!` を独立したマーカーとして追加**した。

| 入力 | 結果 |
|---|---|
| `提出する !金曜` | 期限のみ。重要にはならない |
| `提出する !!` | 重要のみ。日付なし |
| `提出する !!明日` | 重要 + 期限 明日 |

`!!` は `!` に畳んでから期限を解析するので、`!!明日` は自然に「重要かつ明日」と読める。クイック挿入チップにも `!!` を足した（スマホで打ちにくい唯一のマーカーのため）。

**既存タスクは移行していない。** 旧ルールで付いた `important` はそのまま残る。個別に編集シートで直せる。

## 検証済みの挙動

- `#tag` `~見積もり` `!期限` のライブプレビュー（ice タグ / brand バッジ / accent バッジ）
- Enter・送信ボタン双方での保存、入力クリア後もフォーカス維持（連続入力）
- Undo 付きトースト（2.6s で自動消滅）、実行中の AI ジョブも中断される
- オフラインでの即時保存（送信ハンドラの同期コスト 0.5〜3ms）
- リロード後の IndexedDB からの復元
- タップ領域: 上記タブの修正後、44px 未満のインタラクティブ要素なし
- 横スクロール（body の overflow-x）なし
- 編集シート: 全項目の反映、AI 推論の中断、デスクトップでの中央表示
- 削除: 2 段階確認 → UI と IndexedDB の双方から消える
- バックアップ往復: 全消去 → 読み込みで 11 件を完全復元、タイトル一致
- 不正な読み込みファイルの拒否: 壊れた JSON / 別アプリ / 未対応バージョン / 中身なし
- 全消去後にリロードしてもデモデータが復活しない
- BYOK: キーの保存とマスク表示、削除でローカル推定に戻ること、形式チェックによる送信前バリデーション
- **ブラウザから api.anthropic.com へ到達できること**（無効キーで 401 が返る = CORS 通過）。専用ヘッダ無しでは `Failed to fetch` になることも確認
- 無効キーでの恒久エラー: 保存は 4.5ms で完了し、リトライを消費せず即 `aiStatus: "error"`、キューに残骸なし

### GitHub 同期 — Git Data API の手順を実リポジトリで検証

トークンをフォームに入力できないため、アダプタと同一のリクエスト列を `gh api` で再現して確認した:

| 検証 | 結果 |
|---|---|
| ノート2件 + マニフェスト | **3 ファイルが 1 コミット**に入る。日本語ファイル名も通る |
| 更新 + 削除 | マニフェスト記載のノートのみ `sha: null` で削除、他は更新 |
| 手書きノートの保護 | 同じフォルダに置いた手書きノートは削除されない |
| 変更なしの再送 | tree sha が一致 → 空コミットを作らず終了 |

アプリ側は不正トークンでの接続拒否とエラー表示まで確認。**実トークンでの通しは未検証**（トークンの入力は利用者本人が行う必要があるため）。
- 期限の解決 29 ケース（相対語・曜日・M/D・存在しない日・解釈不能）が全て期待どおり
- 構文解析 17 ケース: 既存の `#tag` `~est` `!due` が無変更で通り、`!!` / `!!明日` / 三連 `!!!` / 先頭マーカーも正しい。`!金曜` 単体では重要にならない
- 今日画面のグループ分けと超過の赤表示、タグ画面の絞り込み、予定画面の日付グループ
- デスクトップの 今日/今週/今月 が期限で絞り込む / レールの各項目が対応する画面を出す
- Dexie v1→v2 移行後に `dueAt` インデックスが作られ、全行にフィールドが入る

未検証: v2 移行の「`due` 文字列を持つ既存行の埋め戻し」経路。移行時点の実データに `due` を持つ行が残っていなかったため。処理自体は上記 29 ケースを通した `resolveDue` の呼び出し 1 行。

### iPhone 16 Pro シミュレータ (iOS 18.2) での検証

| 項目 | 結果 |
|---|---|
| 起動 | 白フラッシュなし。ステータスバーは明色グリフ、セーフエリアのインセットも正しい |
| キーボード | WebView が縮み、Capture Dock がキーボード直上に乗る（`resize: "native"` + `100dvh`） |
| チップ挿入 | `#life` `~30m` を挿入 → PARSED プレビューに ice タグ / brand バッジ。フォーカス維持 |
| 保存 | 送信ボタンで即時追加、OPEN 数が更新、入力クリア後もキーボードが開いたまま（連続入力可） |
| Enter キー | ソフトウェアキーボードの return でも保存される |
| 永続化 | アプリ再起動後もタスクが残る（WKWebView 内で IndexedDB が機能） |
| アイコン | ホーム画面に ✕ モチーフのアイコンと「ContextTask」が出る |

未検証:

- **実機** — 署名に Apple ID が要るため。上記手順を参照
- **Undo トースト** — 表示が 2.6s で、シミュレータ操作ツールの往復レイテンシがそれを超えるため捕捉できず。ロジック自体はブラウザで検証済み（プラットフォーム非依存の React 状態）なので、未確認なのは iOS 上での見た目の位置のみ
- **日本語入力** — 操作ツールが ASCII しか送れず IME で化けるため。チップ挿入経路で代替検証した
- **オフライン挙動** — vault 未接続なので同期のオフライン状態自体が発生しない（アダプタを繋いだ時点で要検証）

なお `hydrate()` が失敗すると画面が永久に空になる作りだったため、DB が開けない場合はメモリのみで動作継続するようフォールバックを入れ、描画例外用に ErrorBoundary も追加した。

かつて Vite 開発サーバー経由で vault へ実ファイルを書く実装を入れ、キャプチャ→ノート生成 / チェック→`done: true` 書き換え / UNDO→ノート削除 / 手書きノートの保護、まで実地確認した。スマホ優先の判断でこの経路は撤去済み（履歴は上記「Obsidian 同期」節を参照）。
