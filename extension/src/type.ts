// content script に問い合わせ（レスポンス型を付ける）
type TracePilotResponse = { selectionText: string } | { error: string };

type TracePilotRequest={
    type: "trace-pilot";
}
