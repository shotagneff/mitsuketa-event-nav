import { NextRequest, NextResponse } from "next/server";

type Event = {
  id: string;
  name: string;
  date: string;
  place: string;
  type: string;
  industries: string[];
  experiences: string[];
  description: string;
  companyCount: number;
  capacity: number;
  benefits: string;
  imageUrl?: string;
  matchScore?: number;
  reasons?: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

import eventsJson from "../../../data/events.json";

// イベントIDなどから大まかな「シリーズ（ブランド）」を推定するヘルパー
function getSeriesKey(event: Event): string {
  if (event.id.startsWith("hrteam-")) return "hrteam";
  if (event.id.startsWith("winc-")) return "winc";
  if (event.id.startsWith("dym-")) return "dym";
  if (event.id.startsWith("shachomeshi-")) return "shachomeshi";
  return event.id.split("-")[0] || event.id;
}

const SYSTEM_PROMPT = `あなたは、27卒向け「MITSUKETA」のイベントナビゲーターです。

学生の希望（場所・目的・業界／企業・体験内容）を踏まえて、
サーバー側ですでにスコアリング済みの「候補イベント2件」の情報が渡されます。
あなたはイベントの選定自体は変更せず、
「なぜこの2件が合いそうか」をわかりやすく言語化する役割を担います。

トーン:
- 友達のように親しみやすく、学生の言葉を受け止めながら丁寧に伴走する。
- 「一緒に進めよう」「次はここを考えてみよう」など、寄り添う姿勢を大切にする。
- 初めて就活に臨む学生でも安心できるよう、落ち着いたトーンで温かくサポートする。
- 押しつけではなく、“自分で納得して動けるように導く” ナビゲートを意識する。
- 大げさな表現やドラマチックな言い回し（「とても残念ですが」など）は避け、事実を落ち着いて伝える。

今回のAPI呼び出しでは、すでに4つの質問（場所／目的／業界／体験）の回答はすべて揃っている。
そのため、ここからは「共感・整理フェーズ」と「提案フェーズ」のみを行ってよい。

必ず以下の順番で出力すること:
1. これまでの回答内容の要約と整理（共感コメントを交える）。summaryは2〜4文程度の、コンパクトで読みやすい長さにする。
2. 「あなたの考えが整理できてきましたね。ここからは、これまでの希望に合ったイベントを一緒に見ていきましょう。」と一言入れる
3. 条件に合いそうなイベントを、原則2件提案する
4. 各イベントごとに、次の情報を含める:
   - eventId: イベントID
   - matchScore: 0〜100の数値で、このイベントとのマッチ度（ざっくりでよい）
   - reasons: 箇条書きで2〜3個、「なぜそのイベントが合いそうか」の理由（学生の回答のどの点と結びついているかを明示）
   - summaryText: そのイベントの目的・特徴などを一言でまとめた文章

※MITSUKETA紹介限定特典や公式LINEの案内文、関連候補の列挙などはフロントエンド側で別途表示されるため、ここでは出力しないこと。

イベント選出ルール:
- 提案するイベントは、開催日が「今日以降」のもののみを対象にする。
- 日付が近い順に最大2件まで。
- 学生の希望（地域・目的・体験内容）との一致度が高いものを優先する。
- 開催日が同日の場合は、イベントの特徴や目的がより合致するものを選ぶ。
- 過去日付のイベントは提案に含めない。
- 条件に完全に一致するイベントがない場合でも、「条件に近いイベントを紹介している」ことを率直かつ落ち着いたトーンで伝える。その際、必要以上にネガティブな表現（「紹介できず残念です」など）は避ける。

出力はすべて日本語で行うこと。

最終的な回答は、必ず次のJSON形式「のみ」で出力してください（余計な文章や説明を一切含めないこと）。

{
  "summary": "これまでの回答を整理し、学生の志向をやさしく要約した文章。日本語。",
  "eventMatches": [
    {
      "eventId": "event-1",
      "matchScore": 82,
      "reasons": [
        "東京開催で、あなたの希望するエリアと一致している",
        "IT・WEB業界かつ業界理解が目的で、現在の志向と近い",
        "座談会形式で、人と直接話してみたいという希望に合っている"
      ],
      "summaryText": "IT・WEB業界の理解を深めつつ、現場社員との座談会でリアルな話が聞けるイベントです。"
    }
  ]
}
`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "サーバー側で OpenAI の設定が行われていません。" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      mode = "initial",
      place,
      purpose,
      industry,
      experience,
      messages = [],
      extraUserMessage,
    } = body as {
      mode?: "initial" | "followup";
      place?: string;
      purpose?: string;
      industry?: string;
      experience?: string;
      messages?: ChatMessage[];
      extraUserMessage?: string;
    };

    const allEvents = eventsJson as Event[];

    // 今日以降のイベントだけを対象にする
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingEvents = allEvents.filter((event) => {
      const d = new Date(event.date);
      if (Number.isNaN(d.getTime())) return true; // 日付パースできないものは一応含める
      return d >= today;
    });

    // ユーザー回答をもとに、まずこちら側でざっくりスコアリングして上位候補に絞る
    const scored = upcomingEvents.map((event) => {
      let score = 0;

      // 場所: 完全一致 or オンラインなら少し加点
      if (place && event.place === place) score += 3;
      if (place && event.place === "オンライン" && place === "オンライン") score += 2;

      // 目的: type が purpose に含まれていそうなら加点（ざっくり文字列一致）
      if (purpose && event.type && purpose.includes(event.type.slice(0, 2))) {
        score += 3;
      }

      // 業界: industries のどれかが一致したら加点
      if (industry && event.industries?.length) {
        const hit = event.industries.some((ind) => industry.includes(ind) || ind.includes(industry));
        if (hit) score += 3;
      }

      // 体験スタイル: experiences のどれかが一致したら加点
      if (experience && event.experiences?.length) {
        const hit = event.experiences.some((ex) => experience.includes(ex) || ex.includes(experience));
        if (hit) score += 2;
      }

      return { event, score };
    });

    // スコアが高いものを優先しつつ、同程度なら日付が早いものを上に来るようにソート
    const sortedByScoreAndDate = scored.sort((a, b) => {
      // まずスコアで比較
      if (b.score !== a.score) return b.score - a.score;

      // スコアが同じかほぼ同じなら日付で比較（早い日付を優先）
      const da = new Date(a.event.date);
      const db = new Date(b.event.date);
      if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
      return da.getTime() - db.getTime();
    });

    // 同じシリーズのイベントばかりにならないようにしつつ、最大2件の候補を選ぶ
    const seriesCount = new Map<string, number>();
    const diversifiedTop: Event[] = [];

    for (const item of sortedByScoreAndDate) {
      const seriesKey = getSeriesKey(item.event);
      const current = seriesCount.get(seriesKey) ?? 0;

      // 1シリーズあたり最大2件までを目安にする
      if (current >= 2) continue;

      diversifiedTop.push(item.event);
      seriesCount.set(seriesKey, current + 1);

      if (diversifiedTop.length >= 2) break;
    }

    // もし2件に満たない場合は、シリーズ制限を気にせずスコア順で埋める
    if (diversifiedTop.length < 2) {
      const existingIds = new Set(diversifiedTop.map((e) => e.id));
      for (const item of sortedByScoreAndDate) {
        if (existingIds.has(item.event.id)) continue;
        diversifiedTop.push(item.event);
        existingIds.add(item.event.id);
        if (diversifiedTop.length >= 2) break;
      }
    }

    const topCandidates = diversifiedTop;

    const eventsDescription = topCandidates
      .map((e, index) => {
        return `
[イベント${index + 1}]
ID: ${e.id}
イベント名: ${e.name}
開催日: ${e.date}
開催場所: ${e.place}
タイプ: ${e.type}
想定業界・職種: ${e.industries.join(", ")}
体験内容: ${e.experiences.join(", ")}
特徴・目的: ${e.description}
企業数: ${e.companyCount}
定員: ${e.capacity}
特典・スカウト情報: ${e.benefits}
`;
      })
      .join("\n");

    const baseMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (mode === "initial") {
      const userSummary = `
これまでの回答:
- 参加したい場所: ${place || "未回答"}
- 気になるイベントタイプ: ${purpose || "未回答"}
- 興味のある業界・職種: ${industry || "未回答"}
- 体験したい内容: ${experience || "未回答"}
`;

      const userContent = `${userSummary}\n\n以下が提案に利用できるイベント一覧です。条件に合うものを最大2件まで選び、指示されたフォーマットで出力してください。\n${eventsDescription}`;

      baseMessages.push({ role: "user", content: userContent });
    } else {
      baseMessages.push({
        role: "user",
        content:
          "これは初回のイベント提案が終わったあとの追加相談です。これまでの会話履歴と、学生からの新しい相談内容を踏まえて、追加の提案やアドバイスを行ってください。イベント一覧は以下の通りです。必要に応じて参照しながら回答してください。\n" +
          eventsDescription,
      });

      (messages as ChatMessage[]).forEach((m) => {
        baseMessages.push({ role: m.role, content: m.content });
      });

      if (extraUserMessage) {
        baseMessages.push({ role: "user", content: extraUserMessage });
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: baseMessages,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return NextResponse.json(
        { message: "イベントの提案中にエラーが発生しました。時間をおいて再度お試しください。" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    let summary = "";
    let messageText = "";
    let selectedEvents: Event[] = [];

    try {
      const jsonStart = content.indexOf("{");
      const jsonPayload = jsonStart >= 0 ? content.slice(jsonStart) : content;

      const parsed = JSON.parse(jsonPayload) as {
        summary?: string;
        eventMatches?: {
          eventId: string;
          matchScore?: number;
          reasons?: string[];
          summaryText?: string;
        }[];
      };

      summary = parsed.summary ?? "";
      const matches = parsed.eventMatches ?? [];

      if (matches.length > 0) {
        selectedEvents = matches
          .map((m) => {
            const base = upcomingEvents.find((e) => e.id === m.eventId);
            if (!base) return null;
            return {
              ...base,
              matchScore: m.matchScore,
              reasons: m.reasons,
              // summaryText は今は使わないが、必要であれば別フィールドで追加可能
            } as Event;
          })
          .filter((e): e is Event => e !== null);

        // GPTが1件しか返さなかった場合は、サーバー側候補(topCandidates)から不足分を埋める
        if (selectedEvents.length > 0 && selectedEvents.length < 2) {
          const exists = new Set(selectedEvents.map((e) => e.id));
          for (const cand of topCandidates) {
            if (exists.has(cand.id)) continue;
            selectedEvents.push(cand);
            exists.add(cand.id);
            if (selectedEvents.length >= 2) break;
          }
        }
      }
      messageText = summary || content;
    } catch (e) {
      console.error("Failed to parse assistant JSON:", e, content);
      messageText = content || "イベント提案の結果を取得しました。";
      summary = "";
      selectedEvents = [];
    }

    // フェイルセーフ: OpenAIのeventMatchesから何も選べなかった場合でも、
    // サーバー側でスコアリング済みの候補(topCandidates)から最大2件は返す
    if (selectedEvents.length === 0) {
      selectedEvents = topCandidates;
      if (!summary) {
        summary =
          "あなたの条件にぴったり一致するイベントは見つかりませんでしたが、近い条件のイベントをいくつかご紹介します。気になるものがあれば、まずは雰囲気をつかむつもりで参加してみてください。";
      }
      if (!messageText) {
        messageText = summary;
      }
    }

    return NextResponse.json({ message: messageText, summary, events: selectedEvents });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { message: "リクエストの処理中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
