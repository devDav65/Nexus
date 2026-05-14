import { create } from "zustand"

interface ChatStore {
    replyTo: any | null
    setReplyTo: (msg: any | null) => void
    activeConversationId: string | null
    setActiveConversationId: (id: string | null) => void
}

export const useChatStore = create<ChatStore>((set) => ({
    replyTo: null,
    setReplyTo: (msg) => set({ replyTo: msg }),
    activeConversationId: null,
    setActiveConversationId: (id) => set({ activeConversationId: id }),
}))