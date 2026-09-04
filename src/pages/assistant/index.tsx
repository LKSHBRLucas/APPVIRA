import { Loader2, Send, ShieldAlert, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAiChat, type AiMessage } from "@/hooks/use-ai-chat";
import { cn } from "@/lib/utils";

function MessageBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border bg-card",
        )}
      >
        {message.content || (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {message.isStreaming ? "Pensando..." : ""}
          </span>
        )}
        {message.isStreaming && message.content && (
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />
        )}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const { t } = useTranslation();
  const { messages, isLoading, error, sendMessage, cancel, resetChat } =
    useAiChat();
  const [input, setInput] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  };

  return (
    <div className="animate-fade-in-up flex h-[calc(100vh-8.5rem)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("assistant.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("assistant.subtitle")}</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" onClick={resetChat} aria-label={t("assistant.clear")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.length === 0 && (
          <div className="mt-10 space-y-3">
            <div className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
              {t("assistant.suggest1")}
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
              {t("assistant.suggest2")}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("assistant.placeholder")}
          className="h-12"
          disabled={isLoading}
        />
        {isLoading ? (
          <Button type="button" size="icon" className="h-12 w-12" variant="outline" onClick={cancel}>
            <Loader2 className="h-5 w-5 animate-spin" />
          </Button>
        ) : (
          <Button type="submit" size="icon" className="h-12 w-12" disabled={!input.trim()}>
            <Send className="h-5 w-5" />
          </Button>
        )}
      </form>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        {t("assistant.disclaimer")}
      </p>
    </div>
  );
}
