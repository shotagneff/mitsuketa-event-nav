"use client";

import { useState } from "react";
import Image from "next/image";

const places = ["東京", "大阪", "福岡", "オンライン", "未定"];

const purposes = [
  {
    label: "業界理解系",
    description: "IT・広告・メーカーなど、気になる業界の“ざっくりイメージ”やリアルな働き方を聞けるイベントです。",
  },
  {
    label: "選考直結系",
    description: "イベントに参加することで、そのままエントリーや特別選考につながる、ちょっと本気度高めのイベントです。",
  },
  {
    label: "社長や人事と話せる系",
    description: "社長や人事と少人数でじっくり話して、会社の雰囲気や大事にしている考え方を直接聞けるイベントです。",
  },
  {
    label: "自己分析系",
    description: "これまでの経験を振り返って、「自分ってどんな人か？」を一緒に整理していく系のイベントです。",
  },
  {
    label: "その他",
    description: "「まだよくわからないけど、まずは話を聞いてみたい」という人向けのゆるめスタート枠です。",
  },
];

const industries = [
  "まだ決まっていない",
  "IT・WEB",
  "コンサル",
  "メーカー・製造",
  "商社・専門商社",
  "不動産・建設",
  "金融（銀行・証券・保険）",
  "人材・教育",
  "広告・マーケティング",
  "飲食・観光",
  "ベンチャー・スタートアップ",
  "営業職",
  "総合職・企画職",
];

const experiences = [
  {
    label: "特にこだわりはない",
    description: "「まだピンと来てないけど、とりあえず参加してみたい」という人用のゆるめの選択肢です。",
  },
  {
    label: "座談会",
    description: "社員さんとテーブルを囲んで、ざっくばらんに質問できる“カフェトーク”みたいな雰囲気の場です。",
  },
  {
    label: "GD（グループディスカッション）",
    description: "少人数のチームでテーマについて話し合ってまとめる、選考でもよく出るGDを体験できる場です。",
  },
  {
    label: "プレゼン",
    description: "自分たちで考えたアイデアをみんなの前で発表してみる、“プレゼンに慣れたい人向け”のスタイルです。",
  },
  {
    label: "ワークショップ",
    description: "みんなでお題にチャレンジしながら、フィードバックをもらって“体験しながら学ぶ”スタイルです。",
  },
];

type Step = 1 | 2 | 3 | 4 | 5;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type EventCard = {
  id: string;
  name: string;
  date: string;
  place: string;
  time?: string;
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

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [place, setPlace] = useState("");
  const [purpose, setPurpose] = useState("");
  const [industry, setIndustry] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [followupInput, setFollowupInput] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [events, setEvents] = useState<EventCard[]>([]);

  const canGoNext = () => {
    if (step === 1) return !!place;
    if (step === 2) return !!purpose;
    if (step === 3) return !!industry;
    if (step === 4) return !!experience;
    return true;
  };

  const scrollToLineCta = () => {
    if (typeof document === "undefined") return;
    const el = document.getElementById("line-cta");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSubmit = async () => {
    await callApi("initial");
  };

  const handleFollowupSend = async () => {
    if (!followupInput.trim()) return;
    const content = followupInput.trim();
    setFollowupInput("");
    // 追加相談も、過去の会話履歴には依存せず「コメントを添えた再診断」として扱う
    await callApi("initial", content);
  };

  const handleNext = () => {
    if (!canGoNext()) return;
    if (step < 4) {
      setStep((prev) => (prev + 1) as Step);
    } else {
      setStep(5);
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1 && step <= 4) {
      setStep((prev) => (prev - 1) as Step);
    }
  };

  const handleRestart = () => {
    setStep(1);
    setResult(null);
    setSummary(null);
    setEvents([]);
    setMessages([]);
    setError(null);
  };

  const callApi = async (mode: "initial" | "followup", extraUserMessage?: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/recommend-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          place,
          purpose,
          industry,
          experience,
          messages,
          extraUserMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("サーバーからの応答に問題があります。");
      }
      const data = await response.json();
      const messageText: string = data.message ?? "イベント提案の結果を取得しました。";
      const summaryText: string | null = data.summary ?? null;
      const eventCards: EventCard[] = data.events ?? [];

      setResult(messageText);
      setSummary(summaryText);
      setEvents(eventCards);

      if (mode === "initial") {
        setMessages([
          {
            role: "user",
            content: `場所: ${place}\nタイプ: ${purpose}\n業界: ${industry}\n体験: ${experience}`,
          },
          { role: "assistant", content: messageText },
        ]);
      } else if (mode === "followup" && extraUserMessage) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: extraUserMessage },
          { role: "assistant", content: messageText },
        ]);
      }
    } catch (e) {
      setError(
        "うまく通信できませんでした。少し時間をおいてから再度お試しください。それでも難しい場合は、画面下部のLINEボタンから直接ご相談いただくこともできます。"
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStepTitle = () => {
    if (step === 1) return "まずは、参加したい場所から教えてください。";
    if (step === 2) return "次に、どんなタイプのイベントが気になりますか？";
    if (step === 3) return "興味のある業界や職種について、今のイメージで大丈夫なので教えてください。";
    if (step === 4) return "どんな体験スタイルがしっくりきそうですか？";
    return "ここまでのお話をもとに、なるべく直近の日程からイベントを提案します。";
  };

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            東京・大阪・福岡・オンラインなど、「ここで受けてみたいな」という場所を選んでみましょう。
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {places.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlace(p)}
                className={`rounded-full border px-4 py-2.5 text-sm transition-colors ${
                  place === p
                    ? "border-black bg-black text-white"
                    : "border-zinc-300 bg-white text-zinc-800 hover:border-black/60"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            「自己分析したい」「業界について知りたい」「選考に直結させたい」など、今の気持ちに近いものを選んでください。
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {purposes.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPurpose(p.label)}
                className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                  purpose === p.label
                    ? "border-[#cc3d40] bg-[#cc3d40]/5 text-zinc-900"
                    : "border-zinc-300 bg-white text-zinc-800 hover:border-[#cc3d40]/60"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="mt-1 text-[11px] leading-relaxed text-zinc-500">{p.description}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            まだふわっとしていても大丈夫です。「今のところこれかな」というものを選んでみてください。
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {industries.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndustry(i)}
                className={`rounded-full border px-4 py-2.5 text-sm transition-all ${
                  industry === i
                    ? "border-[#cc3d40] bg-[#cc3d40] text-white"
                    : i === "まだ決まっていない"
                    ? "border-2 border-dashed border-[#cc3d40] bg-amber-50/70 text-zinc-900 font-semibold shadow-sm hover:border-[#b43537] hover:shadow-md hover:-translate-y-0.5"
                    : "border-zinc-300 bg-white text-zinc-800 hover:border-[#cc3d40]/60"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            「ガッツリワークしたい」「ゆるく話を聞きたい」など、イメージに近いものを選んでみてください。
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {experiences.map((e) => (
              <button
                key={e.label}
                type="button"
                onClick={() => setExperience(e.label)}
                className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                  experience === e.label
                    ? "border-[#cc3d40] bg-[#cc3d40]/5 text-zinc-900"
                    : e.label === "特にこだわりはない"
                    ? "border-2 border-dashed border-[#cc3d40] bg-amber-50/70 text-zinc-900 font-semibold shadow-sm hover:border-[#b43537] hover:shadow-md hover:-translate-y-0.5"
                    : "border-zinc-300 bg-white text-zinc-800 hover:border-[#cc3d40]/60"
                }`}
              >
                <span className="font-medium">{e.label}</span>
                <span className="mt-1 text-[11px] leading-relaxed text-zinc-500">{e.description}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <p className="text-sm text-zinc-600">
          あなたの希望を整理して、MITSUKETAイベントから合いそうなものをまとめています。
        </p>
        {loading && (
          <div className="flex items-center justify-center">
            <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 shadow-sm">
              <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              <div className="space-y-0.5">
                <p className="font-medium">イベントを探しています…</p>
                <p className="text-[11px] text-zinc-500">あなたの条件に合う候補をMITSUKETAが整理中です。少しだけお待ちください。</p>
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {summary && (
          <div className="rounded-xl border border-zinc-200 bg-white/80 p-4 text-sm text-zinc-800 shadow-sm">
            {summary}
          </div>
        )}

        {events.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900">あなたにぴったりのイベント候補</h3>
            <p className="text-[11px] text-zinc-500">
              あなたの条件に合いそうなイベントを、最大3件ピックアップしました。
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {[...events]
                .slice()
                .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
                .map((event) => (
                <div
                  key={event.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  {event.imageUrl && (
                    <div className="relative h-40 w-full overflow-hidden bg-zinc-100">
                      <Image
                        src={event.imageUrl}
                        alt={event.name}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="mb-2 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
                      <div className="flex flex-col text-xs text-zinc-700">
                        <span className="text-[11px] font-medium text-zinc-500">開催日時</span>
                        <span className="text-sm font-semibold text-zinc-900">{event.date}</span>
                        {event.time && (
                          <span className="text-[11px] text-zinc-600">{event.time}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span
                          className="rounded-full px-3 py-0.5 text-[11px] font-semibold text-white"
                          style={{
                            backgroundColor:
                              event.place === "オンライン"
                                ? "#16a34a"
                                : event.place === "大阪"
                                ? "#2563eb"
                                : event.place === "福岡"
                                ? "#0f766e"
                                : "#cc3d40",
                          }}
                        >
                          {event.place}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-emerald-700">{event.type}</div>
                    <h4 className="text-lg font-semibold text-zinc-900 line-clamp-2 sm:text-xl">{event.name}</h4>
                    {typeof event.matchScore === "number" && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                          <span>このイベントとのマッチ度</span>
                          <span className="font-semibold text-zinc-700">{Math.round(event.matchScore)}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-[#cc3d40] transition-all duration-300"
                            style={{ width: `${Math.min(Math.max(event.matchScore, 0), 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="mt-1 line-clamp-3 text-xs text-zinc-700">{event.description}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-600">
                      <span className="rounded-full bg-zinc-50 px-2 py-0.5">
                        企業数 {event.companyCount}社 / 定員 {event.capacity}名
                      </span>
                      {event.benefits && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                          🌟 {event.benefits}
                        </span>
                      )}
                    </div>
                    {event.reasons && event.reasons.length > 0 && (
                      <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700">
                        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                          <span>あなたに合いそうなポイント</span>
                        </div>
                        <ul className="space-y-0.5 list-disc pl-4">
                          {event.reasons.map((reason, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={scrollToLineCta}
                        className="inline-flex items-center gap-2 rounded-full bg-[#cc3d40] px-4 py-1.5 text-[12px] font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#b43537]"
                      >
                        このイベントを予約してみる
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && !summary && (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4 text-xs text-zinc-700 whitespace-pre-wrap">
            {result}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[url('/images/coverimage.png')] bg-cover bg-center bg-fixed">
      <div className="min-h-screen bg-white/90 px-4 py-8 font-sans">
        <main className="mx-auto w-full max-w-3xl rounded-3xl bg-white px-5 py-7 shadow-[0_18px_45px_rgba(0,0,0,0.06)] sm:px-8 sm:py-8">
          {/* ヘッダー */}
          <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white overflow-hidden">
                <Image
                  src="/publicmitsuketa-logo.svg"
                  alt="MITSUKETA"
                  width={80}
                  height={80}
                  className="h-18 w-18 object-contain"
                />
              </div>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
                  MITSUKETA イベントナビ
                </h1>
                <p className="text-xs text-zinc-600 sm:text-[13px]">
                  「なんとなく不安」から、「これなら一歩踏み出せそう」へ。あなたに合う就活イベントを、一緒に見つけていきましょう。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start rounded-full border border-[#cc3d40]/20 bg-white px-3 py-1 text-[11px] font-medium text-[#cc3d40]">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#cc3d40]" />
              27卒向け / 診断型イベントレコメンド
            </div>
          </header>

          {/* ステップバー */}
          <section className="mb-6 space-y-2 text-[11px] text-zinc-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
                  STEP {Math.min(step, 4)} / 4
                </span>
                <span className="hidden sm:inline">回答に合わせて、ぴったりのイベントを提案します。</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      step >= s ? "bg-[#cc3d40]" : "bg-zinc-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* 質問・結果エリア */}
          <section className="space-y-6">
            <h2 className="text-base font-medium text-zinc-900">{renderStepTitle()}</h2>
            {renderStepContent()}

            {step === 5 && (
              <div className="mt-6 space-y-3 border-t border-zinc-200 pt-4">
                <p className="text-xs text-zinc-600">
                  ほかの条件でもう一度見てみたくなったら、
                  <span className="font-medium text-zinc-800"> STEP1から診断をやり直す</span>
                  こともできます。
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-[#cc3d40] hover:text-[#cc3d40]"
                  >
                    条件を変えてもう一度診断する
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* フッター＋LINEバナー */}
          <footer className="mt-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 1 || step === 5}
                className="text-xs text-zinc-500 disabled:opacity-40"
              >
                戻る
              </button>
              {step <= 4 && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className="rounded-full bg-[#cc3d40] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#b43537] disabled:opacity-40"
                >
                  {step < 4 ? "次へ進む" : "イベントを提案してもらう"}
                </button>
              )}
            </div>

            <div
              id="line-cta"
              className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-[#cc3d40] via-[#e85b5e] to-[#f97373] px-4 py-4 text-xs text-rose-50 sm:flex-row sm:items-center sm:justify-between sm:py-5"
            >
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1 rounded-full bg-rose-50/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-50">
                  MITSUKETA 特別枠
                </div>
                <p className="text-[13px] font-semibold">MITSUKETA経由なら、はじめての就活イベントも“ひとりじゃない”。</p>
                <p className="leading-relaxed">
                  行きたいイベントが決まったら、公式LINEからイベント名と日付を送ってください。運営にあなたの名前を共有しておくので、当日も安心して参加できます。
                </p>
              </div>
              <div className="mt-1 flex flex-col items-start gap-2 sm:mt-0 sm:items-end">
                <a
                  href="https://form.lmes.jp/landing-qr/2008272618-2J6GkXw4?uLand=gWK1eq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full min-w-[140px] items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-[#16a34a] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22c55e] text-[11px] text-white">
                    L
                  </span>
                  公式LINEを開く
                </a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
