# room-coordinate GAS セットアップ

このフォルダには、Googleスプレッドシートに紐づけて実行するAIレイアウト評価用Apps Scriptを収録しています。

## 1. スプレッドシートへコードを登録

1. 評価ログを保存するGoogleスプレッドシートを1つ作成します。
2. スプレッドシートの「拡張機能」→「Apps Script」を開きます。
3. エディタの「コード.gs」を、このフォルダの「Code.gs」の内容で置き換えます。
4. Apps Scriptの「プロジェクトの設定」で「appsscript.json マニフェスト ファイルをエディタで表示する」を有効にします。
5. 表示された「appsscript.json」を、このフォルダの同名ファイルの内容で置き換えます。
6. プロジェクトを保存し、スプレッドシートを再読み込みします。

## 2. 初期設定

スプレッドシート上部のメニューから次を実行します。

~~~text
room-coordinate → 初期設定
~~~

初回はGoogleアカウントの権限確認が表示されます。許可すると、スプレッドシートIDの保存と「AI評価ログ」シートの作成が行われます。

## 3. Gemini APIキー

Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」に追加します。

| プロパティ | 値 |
|---|---|
| GEMINI_API_KEY | Google AI Studioで発行したAPIキー |
| GEMINI_MODEL | 任意。未設定時は gemini-3.7-flash |

APIキーをCode.gsやゲーム側のJavaScriptへ直接記載しないでください。

## 4. スプレッドシートから接続テスト

次のメニューを実行します。

~~~text
room-coordinate → Gemini接続テスト
~~~

サンプルの家具配置がGeminiへ送られ、成功すると採点結果がダイアログに表示されます。結果とリクエストは「AI評価ログ」シートへ記録されます。

メニューが表示されない場合は、Apps ScriptエディタからonOpenを1度実行するか、スプレッドシートを再読み込みしてください。

Googleスプレッドシートのマクロとして実行したい場合は、「拡張機能」→「マクロ」→「マクロをインポート」からtestGeminiEvaluationを選択できます。

## 5. Webアプリとして公開

1. Apps Script右上の「デプロイ」→「新しいデプロイ」を開きます。
2. 種類に「ウェブアプリ」を選択します。
3. 「次のユーザーとして実行」を自分にします。
4. 「アクセスできるユーザー」を全員にします。
5. デプロイ後に発行される /exec のURLを控えます。

ブラウザでそのURLを開き、次のようなJSONが表示されれば稼働しています。

~~~json
{"ok":true,"service":"room-coordinate-layout-evaluator","version":"1.0"}
~~~

## 6. ゲーム側からの呼び出し例

GASはプリフライトを避けるため、Content-Typeをtext/plainとしてJSON文字列を受け取ります。

~~~js
const response = await fetch(GAS_WEB_APP_URL, {
  method: "POST",
  headers: { "Content-Type": "text/plain" },
  body: JSON.stringify(layoutPayload)
});

const result = await response.json();
if (!result.ok) {
  throw new Error(result.error.message);
}
~~~

mode: no-cors はレスポンスを読み取れなくなるため指定しません。

## 7. 主な関数

| 関数 | 用途 |
|---|---|
| setupRoomCoordinate | ログシートとスプレッドシートIDの初期設定 |
| testGeminiEvaluation | サンプル配置でGemini接続を確認 |
| doGet | Webアプリの稼働確認 |
| doPost | ゲームから評価リクエストを受信 |
| evaluateLayout_ | Gemini APIを呼び出して評価 |

## 8. 注意事項

- 公開URLを知っている人はAPIを呼び出せます。
- 簡易的な10秒間隔の連続送信制限を実装していますが、強固な認証ではありません。
- 不特定多数へ公開する場合はCloudflare Workersなどの中継も検討してください。
- Geminiのモデル名やAPI仕様が変わった場合は、GEMINI_MODELまたはCONFIG.apiUrlを更新します。
