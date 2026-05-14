import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { useSpring } from "@opencode-ai/ui/motion-spring"
import { Tabs } from "@opencode-ai/ui/tabs"
import { PromptInput } from "@/components/prompt-input"
import { useLanguage } from "@/context/language"
import { usePrompt } from "@/context/prompt"
import { useSync } from "@/context/sync"
import { getSessionHandoff, setSessionHandoff } from "@/pages/session/handoff"
import { useSessionKey } from "@/pages/session/session-layout"
import { SessionPermissionDock } from "@/pages/session/composer/session-permission-dock"
import { SessionQuestionDock } from "@/pages/session/composer/session-question-dock"
import { SessionFollowupDock } from "@/pages/session/composer/session-followup-dock"
import { SessionRevertDock } from "@/pages/session/composer/session-revert-dock"
import type { SessionComposerState } from "@/pages/session/composer/session-composer-state"
import { SessionTodoDock } from "@/pages/session/composer/session-todo-dock"
import { HistoryTab } from "@/pages/session/composer/history-tab"
import type { FollowupDraft } from "@/components/prompt-input/submit"
import { createResizeObserver } from "@solid-primitives/resize-observer"

export function SessionComposerRegion(props: {
  state: SessionComposerState
  ready: boolean
  centered: boolean
  inputRef: (el: HTMLDivElement) => void
  newSessionWorktree: string
  onNewSessionWorktreeReset: () => void
  onSubmit: () => void
  onResponseSubmit: () => void
  followup?: {
    queue: () => boolean
    items: { id: string; text: string }[]
    sending?: string
    edit?: { id: string; prompt: FollowupDraft["prompt"]; context: FollowupDraft["context"] }
    onQueue: (draft: FollowupDraft) => void
    onAbort: () => void
    onSend: (id: string) => void
    onEdit: (id: string) => void
    onEditLoaded: () => void
  }
  revert?: {
    items: { id: string; text: string }[]
    restoring?: string
    disabled?: boolean
    onRestore: (id: string) => void
  }
  setPromptDockRef: (el: HTMLDivElement) => void
}) {
  const navigate = useNavigate()
  const prompt = usePrompt()
  const language = useLanguage()
  const route = useSessionKey()
  const sync = useSync()

  const handoffPrompt = createMemo(() => getSessionHandoff(route.sessionKey())?.prompt)
  const info = createMemo(() => (route.params.id ? sync.session.get(route.params.id) : undefined))
  const parentID = createMemo(() => info()?.parentID)
  const child = createMemo(() => !!parentID())
  const showComposer = createMemo(() => !props.state.blocked() || child())

  const [composerTab, setComposerTab] = createSignal<"input" | "history">("input")

  const previewPrompt = () =>
    prompt
      .current()
      .map((part) => {
        if (part.type === "file") return `[file:${part.path}]`
        if (part.type === "agent") return `@${part.name}`
        if (part.type === "image") return `[image:${part.filename}]`
        return part.content
      })
      .join("")
      .trim()

  createEffect(() => {
    if (!prompt.ready()) return
    setSessionHandoff(route.sessionKey(), { prompt: previewPrompt() })
  })

  const [store, setStore] = createStore({
    ready: false,
    height: 320,
    body: undefined as HTMLDivElement | undefined,
  })
  let timer: number | undefined
  let frame: number | undefined

  const clear = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timer = undefined
    }
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
      frame = undefined
    }
  }

  createEffect(() => {
    route.sessionKey()
    const ready = props.ready
    const delay = 140

    clear()
    setStore("ready", false)
    if (!ready) return

    frame = requestAnimationFrame(() => {
      frame = undefined
      timer = window.setTimeout(() => {
        setStore("ready", true)
        timer = undefined
      }, delay)
    })
  })

  onCleanup(clear)

  const open = createMemo(() => store.ready && props.state.dock() && !props.state.closing())
  const progress = useSpring(() => (open() ? 1 : 0), { visualDuration: 0.3, bounce: 0 })
  const value = createMemo(() => Math.max(0, Math.min(1, progress())))
  const dock = createMemo(() => (store.ready && props.state.dock()) || value() > 0.001)
  const rolled = createMemo(() => (props.revert?.items.length ? props.revert : undefined))
  const lift = createMemo(() => (rolled() ? 18 : 36 * value()))
  const full = createMemo(() => Math.max(78, store.height))

  const openParent = () => {
    const id = parentID()
    if (!id) return
    navigate(`/${route.params.dir}/session/${id}`)
  }

  createEffect(() => {
    const el = store.body
    if (!el) return
    const update = () => setStore("height", el.getBoundingClientRect().height)
    createResizeObserver(store.body, update)
    update()
  })

  return (
    <div
      ref={props.setPromptDockRef}
      data-component="session-prompt-dock"
      class="shrink-0 w-full pb-3 flex flex-col justify-center items-center bg-background-stronger pointer-events-none"
    >
      <div
        classList={{
          "w-full px-3 pointer-events-auto": true,
          "md:max-w-200 md:mx-auto 2xl:max-w-[1000px]": props.centered,
        }}
      >
        <Show when={props.state.questionRequest()} keyed>
          {(request) => (
            <div>
              <SessionQuestionDock request={request} onSubmit={props.onResponseSubmit} />
            </div>
          )}
        </Show>

        <Show when={props.state.permissionRequest()} keyed>
          {(request) => (
            <div>
              <SessionPermissionDock
                request={request}
                responding={props.state.permissionResponding()}
                onDecide={(response) => {
                  props.onResponseSubmit()
                  props.state.decide(response)
                }}
              />
            </div>
          )}
        </Show>

        <Show when={showComposer()}>
          <Show
            when={prompt.ready()}
            fallback={
              <>
                <Show when={rolled()} keyed>
                  {(revert) => (
                    <div class="pb-2">
                      <SessionRevertDock
                        items={revert.items}
                        restoring={revert.restoring}
                        disabled={revert.disabled}
                        onRestore={revert.onRestore}
                      />
                    </div>
                  )}
                </Show>
                <div class="w-full min-h-32 md:min-h-40 rounded-md border border-border-weak-base bg-background-base/50 px-4 py-3 text-text-weak whitespace-pre-wrap pointer-events-none">
                  {handoffPrompt() || language.t("prompt.loading")}
                </div>
              </>
            }
          >
            <Show when={dock()}>
              <div
                classList={{
                  "overflow-hidden": true,
                  "pointer-events-none": value() < 0.98,
                }}
                style={{
                  "max-height": `${full() * value()}px`,
                }}
              >
                <div ref={(el) => setStore("body", el)}>
                  <SessionTodoDock
                    sessionID={route.params.id}
                    todos={props.state.todos()}
                    collapseLabel={language.t("session.todo.collapse")}
                    expandLabel={language.t("session.todo.expand")}
                    dockProgress={value()}
                  />
                </div>
              </div>
            </Show>
            <Show when={rolled()} keyed>
              {(revert) => (
                <div
                  style={{
                    "margin-top": `${-36 * value()}px`,
                  }}
                >
                  <SessionRevertDock
                    items={revert.items}
                    restoring={revert.restoring}
                    disabled={revert.disabled}
                    onRestore={revert.onRestore}
                  />
                </div>
              )}
            </Show>
            <div
              classList={{
                "relative z-10": true,
              }}
              style={{
                "margin-top": `${-lift()}px`,
              }}
            >
              <Show when={props.followup?.items.length}>
                <SessionFollowupDock
                  items={props.followup!.items}
                  sending={props.followup!.sending}
                  onSend={props.followup!.onSend}
                  onEdit={props.followup!.onEdit}
                />
              </Show>
              <div class="flex flex-col md:flex-row gap-2 items-stretch">
                <div class="flex-1 min-w-0">
                  <Show
                    when={child()}
                    fallback={
                      <Show when={!props.state.blocked()}>
                        <PromptInput
                          ref={props.inputRef}
                          newSessionWorktree={props.newSessionWorktree}
                          onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
                          edit={props.followup?.edit}
                          onEditLoaded={props.followup?.onEditLoaded}
                          shouldQueue={props.followup?.queue}
                          onQueue={props.followup?.onQueue}
                          onAbort={props.followup?.onAbort}
                          onSubmit={props.onSubmit}
                        />
                      </Show>
                    }
                  >
                    <div
                      ref={props.inputRef}
                      class="w-full rounded-[12px] border border-border-weak-base bg-background-base p-3 text-16-regular text-text-weak"
                    >
                      <span>{language.t("session.child.promptDisabled")} </span>
                      <Show when={parentID()}>
                        <button
                          type="button"
                          class="text-text-base transition-colors hover:text-text-strong"
                          onClick={openParent}
                        >
                          {language.t("session.child.backToParent")}
                        </button>
                      </Show>
                    </div>
                  </Show>
                </div>
                <div class="shrink-0 md:w-56 w-full rounded-[12px] border border-border-weak-base bg-background-base overflow-hidden flex flex-col" style={{ "max-height": "160px" }}>
                  <Tabs value={composerTab()} onChange={(v) => setComposerTab(v as "input" | "history")} variant="pill" class="flex flex-col h-full">
                    <Tabs.List class="shrink-0 px-2 pt-1.5 pb-1">
                      <Tabs.Trigger value="input" class="flex-1" classes={{ button: "w-full text-11-medium" }}>
                        Input
                      </Tabs.Trigger>
                      <Tabs.Trigger value="history" class="flex-1" classes={{ button: "w-full text-11-medium" }}>
                        History
                      </Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="input" class="flex-1 min-h-0 overflow-hidden px-2 pb-2">
                      <div class="text-11-regular text-text-weak h-full overflow-y-auto" style={{ "scrollbar-width": "thin" }}>
                        <Show
                          when={route.params.id}
                          fallback={<span class="italic">Start a conversation to see your input here.</span>}
                        >
                          <span class="italic text-text-weaker">Current prompt shown in the input box.</span>
                        </Show>
                      </div>
                    </Tabs.Content>
                    <Tabs.Content value="history" class="flex-1 min-h-0 overflow-hidden">
                      <HistoryTab sessionID={route.params.id} />
                    </Tabs.Content>
                  </Tabs>
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
