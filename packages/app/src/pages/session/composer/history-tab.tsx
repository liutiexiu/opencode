import { For, Show, createMemo, createSignal } from "solid-js"
import type { Message, Part } from "@opencode-ai/sdk/v2/client"
import { useSync } from "@/context/sync"

function HistoryEntry(props: { message: Message; parts: Part[] }) {
  const [expanded, setExpanded] = createSignal(false)

  const text = createMemo(() =>
    props.parts
      .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join(""),
  )

  const truncated = createMemo(() => {
    const t = text()
    return t.length > 200 ? t.slice(0, 200) + "…" : t
  })

  const isLong = createMemo(() => text().length > 200)
  const displayed = createMemo(() => (expanded() ? text() : truncated()))

  return (
    <Show when={text()}>
      <div class="flex flex-col gap-0.5">
        <div
          class="text-10-medium"
          classList={{
            "text-text-tint": props.message.role === "user",
            "text-text-weak": props.message.role === "assistant",
          }}
        >
          {props.message.role === "user" ? "You" : "Assistant"}
        </div>
        <div class="text-11-regular text-text-base leading-relaxed whitespace-pre-wrap break-words">
          {displayed()}
          <Show when={isLong()}>
            <button
              type="button"
              class="ml-1 text-10-medium text-text-tint hover:text-text-strong transition-colors"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded() ? "less" : "more"}
            </button>
          </Show>
        </div>
      </div>
    </Show>
  )
}

export function HistoryTab(props: { sessionID: string | undefined }) {
  const sync = useSync()

  const messages = createMemo(() => (props.sessionID ? (sync.data.message[props.sessionID] ?? []) : []))

  const entries = createMemo(() =>
    messages().flatMap((msg): { message: Message; parts: Part[] }[] => {
      if (msg.role !== "user" && msg.role !== "assistant") return []
      const parts = sync.data.part[msg.id] ?? []
      const hasText = parts.some((p) => p.type === "text")
      if (!hasText) return []
      return [{ message: msg, parts }]
    }),
  )

  return (
    <div
      class="flex flex-col gap-3 overflow-y-auto px-3 py-2 h-full"
      data-scrollable
      style={{ "scrollbar-width": "thin" }}
    >
      <Show
        when={entries().length > 0}
        fallback={<div class="text-11-regular text-text-weak italic">No conversation history yet.</div>}
      >
        <For each={entries()}>
          {(entry) => <HistoryEntry message={entry.message} parts={entry.parts} />}
        </For>
      </Show>
    </div>
  )
}
