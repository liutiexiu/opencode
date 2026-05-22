import { For, Show, createMemo, createSignal } from "solid-js"
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
  return stripSystemReminders(textParts.at(-1)?.text ?? "")
}

const LONG_CONTENT_THRESHOLD = 150
const KEEP_EDGE = 75

function stripSystemReminders(text: string): string {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "").trim()
}

function allText(parts: PartLike[]): string {
  return stripSystemReminders(
    parts
      .filter((p): p is TextPart => p.type === "text" && !p.synthetic && !p.ignored)
      .map((p) => p.text)
      .join(""),
  )
}

function truncate(text: string, max = 300): string {
  return text.length > max ? text.slice(0, max) + "…" : text
}

type Entry = { message: Message; parts: PartLike[] }
type ConversationGroup = { user: Entry; replies: Entry[] }

function AssistantRow(props: { entry: Entry }) {
  const label = createMemo(() => (props.entry.message as AssistantMessage).agent || "assistant")
  const content = createMemo(() => truncate(lastText(props.entry.parts)))

  return (
    <div class="flex flex-col gap-0.5 px-2.5 py-1.5 border-t border-border-weaker-base bg-background-stronger">
      <span class="text-11-medium text-text-strong shrink-0" style={{ "font-weight": "600" }}>
        {label()}
      </span>
      <Show when={content()}>
        <p class="text-12-regular text-text-base whitespace-pre-wrap break-words m-0">{content()}</p>
      </Show>
    </div>
  )
}

function ConversationGroupRow(props: { group: ConversationGroup }) {
  const [expanded, setExpanded] = createSignal(false)

  const userMsg = () => props.group.user.message as UserMessage
  const parts = () => props.group.user.parts
  const rawText = createMemo(() => allText(parts()))
  const isLong = createMemo(() => rawText().length > LONG_CONTENT_THRESHOLD)
  const head = createMemo(() => (isLong() ? rawText().slice(0, KEEP_EDGE) : ""))
  const tail = createMemo(() => (isLong() ? rawText().slice(-KEEP_EDGE) : ""))
  const short = createMemo(() => (!isLong() ? rawText() : ""))
  const hasReplies = () => props.group.replies.length > 0

  return (
    <div class="flex flex-col border-b border-border-weaker-base last:border-0">
      <button
        type="button"
        class="flex flex-col gap-0.5 px-2.5 py-2 text-left w-full cursor-pointer rounded-none bg-background-stronger"
        onClick={() => hasReplies() && setExpanded((v) => !v)}
      >
        <div class="flex items-baseline gap-1.5">
          <span class="text-11-medium text-text-interactive-base shrink-0" style={{ "font-weight": "700" }}>
            User
          </span>
          <span class="text-11-medium text-text-weaker shrink-0" style={{ "font-weight": "400" }}>
            ({formatChinaTime(userMsg().time.created)})
          </span>
          <Show when={hasReplies()}>
            <span
              class="ml-auto text-11-medium text-text-weaker shrink-0"
              style={{ "font-weight": "400" }}
            >
              {expanded() ? "▾" : "▸"} {props.group.replies.length}
            </span>
          </Show>
        </div>

        <Show when={!isLong()}>
          <p class="text-12-regular text-text-base whitespace-pre-wrap break-words m-0">{short()}</p>
        </Show>
        <Show when={isLong()}>
          <p class="text-12-regular text-text-base whitespace-pre-wrap break-words m-0">{head()}</p>
          <p class="text-11-regular text-text-weaker text-center m-0 py-0.5 select-none">···</p>
          <p class="text-12-regular text-text-base whitespace-pre-wrap break-words m-0">{tail()}</p>
        </Show>
      </button>

      <Show when={expanded()}>
        <For each={props.group.replies}>{(reply) => <AssistantRow entry={reply} />}</For>
      </Show>
    </div>
  )
}

export function HistoryTab(props: { sessionID: string | undefined }) {
  const sync = useSync()

  const entries = createMemo(() => {
    if (!props.sessionID) return []
    return (sync.data.message[props.sessionID] ?? []).flatMap(
      (msg): Entry[] => {
        if (msg.role !== "user" && msg.role !== "assistant") return []
        if (msg.role === "assistant") {
          const a = msg as AssistantMessage
          if (typeof a.time.completed !== "number") return []
          if (a.summary) return []
        }
        const parts = (sync.data.part[msg.id] ?? []) as PartLike[]
        const hasRealText = parts.some(
          (p) => p.type === "text" && !p.synthetic && !p.ignored && stripSystemReminders((p as TextPart).text ?? "").length > 0,
        )
        if (!hasRealText) return []
        return [{ message: msg, parts }]
      },
    )
  })

  const groups = createMemo((): ConversationGroup[] => {
    const result: ConversationGroup[] = []
    let current: ConversationGroup | null = null
    for (const entry of entries()) {
      if (entry.message.role === "user") {
        current = { user: entry, replies: [] }
        result.push(current)
      } else if (current) {
        current.replies.push(entry)
      }
    }
    return result
  })

  return (
    <div
      class="flex flex-col h-full overflow-y-auto py-1 select-text"
      data-scrollable
      style={{ "scrollbar-width": "thin" }}
    >
      <Show
        when={groups().length > 0}
        fallback={
          <div class="flex items-center justify-center h-full py-8">
            <span class="text-12-regular text-text-weaker italic">暂无对话记录</span>
          </div>
        }
      >
        <For each={groups()}>{(group) => <ConversationGroupRow group={group} />}</For>
      </Show>
    </div>
  )
}
