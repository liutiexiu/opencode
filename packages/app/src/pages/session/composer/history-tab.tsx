import { For, Show, createMemo } from "solid-js"
import type { AssistantMessage, Message, TextPart, UserMessage } from "@opencode-ai/sdk/v2/client"
import { useSync } from "@/context/sync"

function formatChinaTime(ms: number): string {
  return new Date(ms).toLocaleString("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

type PartLike = { type: string; text?: string; synthetic?: boolean; ignored?: boolean }

function lastText(parts: PartLike[]): string {
  const textParts = parts.filter(
    (p): p is TextPart => p.type === "text" && typeof (p as TextPart).text === "string" && !p.synthetic && !p.ignored,
  )
  return textParts.at(-1)?.text?.trim() ?? ""
}

const LONG_CONTENT_THRESHOLD = 150
const KEEP_EDGE = 75

function allText(parts: PartLike[]): string {
  return parts
    .filter((p): p is TextPart => p.type === "text" && !p.synthetic && !p.ignored)
    .map((p) => p.text)
    .join("")
    .trim()
}

function truncate(text: string, max = 300): string {
  return text.length > max ? text.slice(0, max) + "…" : text
}

function HistoryMessage(props: { message: Message; parts: PartLike[] }) {
  const isUser = () => props.message.role === "user"

  const label = createMemo(() => {
    if (props.message.role === "user") return "User"
    return (props.message as AssistantMessage).agent || "assistant"
  })

  const rawUserText = createMemo(() => (isUser() ? allText(props.parts) : ""))

  const isLong = createMemo(() => isUser() && rawUserText().length > LONG_CONTENT_THRESHOLD)

  const head = createMemo(() => (isLong() ? rawUserText().slice(0, KEEP_EDGE) : ""))
  const tail = createMemo(() => (isLong() ? rawUserText().slice(-KEEP_EDGE) : ""))
  const short = createMemo(() => (!isLong() && isUser() ? rawUserText() : ""))

  const assistantContent = createMemo(() => (!isUser() ? truncate(lastText(props.parts)) : ""))

  const hasContent = createMemo(() =>
    isUser() ? rawUserText().length > 0 : assistantContent().length > 0,
  )

  return (
    <Show when={hasContent()}>
      <div class="flex flex-col gap-0.5 py-2 border-b border-border-weaker-base last:border-0">
        <div class="flex items-baseline gap-1.5 shrink-0">
          <span
            class="text-11-medium text-text-strong"
            style={isUser() ? { "font-weight": "700" } : undefined}
          >
            {label()}
          </span>
          <Show when={isUser()}>
            <span class="text-11-medium text-text-weaker" style={{ "font-weight": "400" }}>
              ({formatChinaTime((props.message as UserMessage).time.created)})
            </span>
          </Show>
        </div>
        <Show when={!isUser()}>
          <p class="text-12-regular text-text-base leading-relaxed whitespace-pre-wrap break-words m-0">
            {assistantContent()}
          </p>
        </Show>
        <Show when={isUser() && !isLong()}>
          <p class="text-12-regular text-text-base leading-relaxed whitespace-pre-wrap break-words m-0">{short()}</p>
        </Show>
        <Show when={isLong()}>
          <p class="text-12-regular text-text-base leading-relaxed whitespace-pre-wrap break-words m-0">{head()}</p>
          <p class="text-11-regular text-text-weaker text-center m-0 py-0.5 select-none">···</p>
          <p class="text-12-regular text-text-base leading-relaxed whitespace-pre-wrap break-words m-0">{tail()}</p>
        </Show>
      </div>
    </Show>
  )
}

export function HistoryTab(props: { sessionID: string | undefined }) {
  const sync = useSync()

  const entries = createMemo(() => {
    if (!props.sessionID) return []
    return (sync.data.message[props.sessionID] ?? []).flatMap(
      (msg): { message: Message; parts: PartLike[] }[] => {
        if (msg.role !== "user" && msg.role !== "assistant") return []
        if (msg.role === "assistant") {
          const a = msg as AssistantMessage
          if (typeof a.time.completed !== "number") return []
          if (a.summary) return []
        }
        const parts = (sync.data.part[msg.id] ?? []) as PartLike[]
        const hasRealText = parts.some((p) => p.type === "text" && !p.synthetic && !p.ignored)
        if (!hasRealText) return []
        return [{ message: msg, parts }]
      },
    )
  })

  return (
    <div class="flex flex-col h-full overflow-y-auto px-3 py-1 select-text" data-scrollable style={{ "scrollbar-width": "thin" }}>
      <Show
        when={entries().length > 0}
        fallback={
          <div class="flex items-center justify-center h-full py-8">
            <span class="text-12-regular text-text-weaker italic">暂无对话记录</span>
          </div>
        }
      >
        <For each={entries()}>{(entry) => <HistoryMessage message={entry.message} parts={entry.parts} />}</For>
      </Show>
    </div>
  )
}
