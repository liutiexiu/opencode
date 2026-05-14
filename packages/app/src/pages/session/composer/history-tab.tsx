import { For, Show, createMemo } from "solid-js"
import type { AssistantMessage, Message, TextPart } from "@opencode-ai/sdk/v2/client"
import { useSync } from "@/context/sync"

type PartLike = { type: string; text?: string }

function lastText(parts: PartLike[]): string {
  const textParts = parts.filter((p): p is TextPart => p.type === "text" && typeof (p as TextPart).text === "string")
  return textParts.at(-1)?.text?.trim() ?? ""
}

function allText(parts: PartLike[]): string {
  return parts
    .filter((p): p is TextPart => p.type === "text")
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
    if (props.message.role === "user") return "user"
    return (props.message as AssistantMessage).agent || "assistant"
  })

  const content = createMemo(() => {
    if (props.message.role === "user") return truncate(allText(props.parts))
    return truncate(lastText(props.parts))
  })

  return (
    <Show when={content()}>
      <div class="flex flex-col gap-0.5 py-2 border-b border-border-weaker-base last:border-0">
        <span
          class="text-11-medium shrink-0"
          classList={{
            "text-text-tint": isUser(),
            "text-text-weak": !isUser(),
          }}
        >
          {label()}
        </span>
        <p class="text-12-regular text-text-base leading-relaxed whitespace-pre-wrap break-words m-0">{content()}</p>
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
        if (msg.role === "assistant" && typeof (msg as AssistantMessage).time.completed !== "number") return []
        const parts = (sync.data.part[msg.id] ?? []) as PartLike[]
        if (!parts.some((p) => p.type === "text")) return []
        return [{ message: msg, parts }]
      },
    )
  })

  return (
    <div class="flex flex-col h-full overflow-y-auto px-3 py-1" data-scrollable style={{ "scrollbar-width": "thin" }}>
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
