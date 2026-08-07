# Micro Sakura Studio

**完全無料** のバーチャルアナログ・シンセサイザー / DTM（音楽制作）アプリです。
Korg microKORG 系のシンセシス（2オシレーター + フィルター + アンプ/フィルターEG + LFO x2 +
アルペジエーター）をブラウザの Web Audio API だけで再現し、さらに複数トラックの
ステップ/ピアノロール・シーケンサーを備えた統合ワークステーションです。

外部ライブラリ・有料サンプル・課金要素は一切なし。ソースコードのみで音を生成しています。

> 🎹 **姉妹アプリ: [Aozora Grand Piano](PIANO.md)** … 同じリポジトリに、サンプル音源を使わない
> 物理モデリング方式のグランドピアノ・アプリを収録しています（`/piano/` で公開、
> 開発時は `npm run piano:dev`）。仕様と仕組みは [PIANO.md](PIANO.md) を参照してください。

## 主な機能

- **シンセシス・エンジン**
  - OSC1 / OSC2：Saw, Square, Pulse(PWM), Triangle, Sine, Super Saw, Noise
  - オシレーター・ミックス、リングモジュレーション、オシレーター・シンク（近似）
  - フィルター：LPF / HPF / BPF / Notch（カットオフ・レゾナンス・エンベロープ量・キートラック）
  - アンプEG / フィルターEG（ADSR）
  - LFO x2（Pitch / Filter / Amp / Pan にルーティング可能、波形5種）
  - ポルタメント（モノシンス・グライド）
  - アルペジエーター（Up/Down/Up-Down/Random/Order、オクターブ・レンジ、ゲート）
  - エフェクト：ドライブ（歪み）、コーラス、ディレイ、リバーブ、3バンドEQ、コンプレッサー
- **音源プリセット** … ベース／リード／パッド／キーボード／ベル・プラック／ブラス・ストリングス／
  SFX／ドラム（キック、スネア、ハイハット、タム、シンバル、カウベル等）まで **約45種類** を収録。
  すべてパラメータ編集・保存可能。
- **マルチトラック・シーケンサー** … トラックごとに音源を割り当て、ピアノロールで
  ノートを打ち込み（8〜64ステップ、スイング対応）。ミュート／ソロ／音量／パン。
- **演奏方法** … 画面上のバーチャル鍵盤、PCキーボード（ZSXDCVGBHNJM,.../QWERTY... の2段配置、
  矢印キーでオクターブ切替）、**Web MIDI** で実機のMIDIキーボードにも対応。
- **書き出し** … リアルタイム録音した演奏や再生中のシーケンスを **WAV** としてダウンロード。
  楽曲データ（トラック・パターン・音色）はJSONで保存／読込可能。

## 動作環境

- **ブラウザ** … Chrome / Edge / Firefox 等、Web Audio API 対応ブラウザで動作（Windows / Mac / Linux）。
- **Windows デスクトップアプリ** … Electron でラップし、ポータブル exe としてビルド可能。

## セットアップ

```bash
cd dtm-synth
npm install
```

## ブラウザで実行（開発）

```bash
npm run dev
```

表示された `http://localhost:5174/` を開き、「オーディオを開始」ボタンをクリックしてください
（ブラウザの自動再生制限のため、最初のクリックが必要です）。

## 本番ビルド（静的ファイル）

```bash
npm run build      # dist/ に出力
npm run preview    # ビルド結果をローカルで確認
```

`dist/` フォルダをそのまま任意の静的Webホスティング（GitHub Pages 等）にアップロードすれば
そのままブラウザ版として公開できます。

## スマホで使う（完全無料 / GitHub Pages）

このリポジトリには `main` ブランチへの push で自動的に GitHub Pages へビルド・公開する
GitHub Actions ワークフロー（`.github/workflows/deploy-pages.yml`）が含まれています。

1. GitHub リポジトリの **Settings → Pages → Build and deployment** で
   Source を **GitHub Actions** に設定してください（初回のみ）。
2. `main` ブランチに push すると自動的にビルドされ、
   `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。
3. スマホのブラウザ（Safari / Chrome）でその URL を開き、
   「ホーム画面に追加」を行うとアプリのように起動できます（PWA対応、オフラインキャッシュあり）。

料金は一切かかりません（GitHub Pages・GitHub Actions のパブリックリポジトリ無料枠のみ使用）。

## Windows デスクトップアプリ化（Electron / 無料）

```bash
npm run electron:build   # dist/ をビルドし、ポータブル exe を生成
```

`dist/*.exe`（electron-builder の出力フォルダ、既定では `release/` または `dist/` 配下）が生成され、
インストール不要でそのまま実行できるポータブル版 Windows アプリになります。

開発中に Electron 版を素早く確認したい場合:

```bash
npm run electron:dev
```

## 操作のヒント

- **矢印キー（← / →）** … PCキーボード演奏時のオクターブ切替
- **PCキーボード** … 下段 `Z S X D C V G B H N J M , L . ; /` が白鍵/黒鍵、上段 `Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P` がオクターブ上
- **アルペジエーター** … シンセパネル右下の ARPEGGIATOR モジュールで ON にすると、鍵盤を押している間
  自動的にフレーズを演奏します
- **トラック追加** … 左側の「+ トラック追加」から音源トラックを増やし、それぞれ独立した音色・
  ピアノロールパターンを持たせられます

## ディレクトリ構成

```
src/
  audio/
    AudioEngine.ts   マスター・エフェクト（EQ/コンプ/リバーブ/ディレイ/コーラス）、WAV録音・書き出し
    Voice.ts         1音分の音声生成（オシレーター・フィルター・EG・LFO・ドラム音源）
    SynthEngine.ts   ポリフォニー管理・モノ/レガート
    Arpeggiator.ts   アルペジエーター
    Sequencer.ts     マルチトラック・ピアノロール・シーケンサー
    MidiInput.ts     Web MIDI 入力・PCキーボード入力
    presets.ts       音源プリセット（約45種類）
    types.ts         パラメータの型定義
  ui/
    Knob.ts          ノブ／セレクト／トグルUIコンポーネント
    SynthPanel.ts    シンセ・パラメータパネル
    PatchBrowser.ts  音源プリセット一覧
    SequencerGrid.ts ピアノロールUI
    Keyboard.ts      バーチャル鍵盤
    App.ts           全体のレイアウト・配線
  styles/main.css    プロフェッショナル・ダークテーマ（ハードウェアシンセ風UI）
electron/main.cjs     Windows デスクトップアプリ用 Electron エントリーポイント
```

## 技術スタック

- [Web Audio API](https://developer.mozilla.org/ja/docs/Web/API/Web_Audio_API) … 音声合成・エフェクト（外部オーディオライブラリ不使用）
- [Web MIDI API](https://developer.mozilla.org/ja/docs/Web/API/Web_MIDI_API) … 外部MIDI鍵盤対応
- [TypeScript](https://www.typescriptlang.org/) / [Vite](https://vitejs.dev/)
- [Electron](https://www.electronjs.org/) … Windows デスクトップアプリ化（無料・OSS）

## 今後の拡張アイデア

- 真のハードシンク／FM合成（AudioWorklet 化）
- サンプラー・トラック（ユーザー音声ファイルの読み込み）
- オートメーション（ノブの時間変化を打ち込み）
- VST風のプラグイン形式でのエフェクト追加
