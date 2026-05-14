import { useParams } from "@solidjs/router"
import { type ParentProps, onCleanup, onMount } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"

export function IdeViewBridgeProvider(props: ParentProps) {
  const globalSDK = useGlobalSDK()
  const params = useParams<{ dir?: string; id?: string }>()

  onMount(() => {
    const handleSubmitPrompt = (event: Event) => {
      const sessionID = params.id
      if (!sessionID) return

      const prompt = (event as CustomEvent<{ prompt: string }>).detail?.prompt
      if (!prompt?.trim()) return

      const client = globalSDK.createClient({
        directory: decodeURIComponent(atob(params.dir ?? "")),
        throwOnError: false,
      })

      void client.session.promptAsync({
        sessionID,
        parts: [{ type: "text", text: prompt }],
      })
    }

    const handleFillPrompt = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt: string }>).detail?.prompt
      if (!prompt?.trim()) return

      const editor = document.querySelector('[data-component="prompt-input"]') as HTMLElement | null
      if (!editor) return

      editor.innerHTML = ""
      editor.textContent = prompt
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }))

      requestAnimationFrame(() => {
        editor.focus()
        const range = document.createRange()
        const selection = window.getSelection()
        range.selectNodeContents(editor)
        range.collapse(false)
        selection?.removeAllRanges()
        selection?.addRange(range)
      })
    }

    window.addEventListener("opencode:submitPrompt", handleSubmitPrompt)
    window.addEventListener("opencode:fillPrompt", handleFillPrompt)
    onCleanup(() => {
      window.removeEventListener("opencode:submitPrompt", handleSubmitPrompt)
      window.removeEventListener("opencode:fillPrompt", handleFillPrompt)
    })
  })

  return <>{props.children}</>
}
