import { useCallback, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/client";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const EDGE_FUNCTION_NAME = "assistant-chat";

const FALLBACK_MESSAGES: Record<string, string> = {
  authentication_error: "Sessão expirada. Recarregue a página e tente de novo.",
  rate_limit_error: "Muitas mensagens seguidas. Espere um pouco e tente de novo.",
  invalid_request_error: "Não entendi a mensagem. Reformule e tente de novo.",
  overloaded_error: "O assistente está ocupado. Tente de novo em instantes.",
  insufficient_credits:
    "Os créditos de IA deste app acabaram. Fale com o administrador.",
  permission_error: "A IA está desativada neste app. Fale com o administrador.",
  api_error: "O serviço de IA está indisponível no momento.",
};

function userFacingError(code: string | undefined, backendMessage: string): string {
  if (backendMessage) return backendMessage;
  return FALLBACK_MESSAGES[code ?? ""] ?? "Não foi possível responder agora. Tente de novo.";
}

function updateLastAssistant(
  messages: AiMessage[],
  updates: Partial<AiMessage>,
): AiMessage[] {
  const updated = [...messages];
  const last = updated[updated.length - 1];
  if (last?.role === "assistant") {
    updated[updated.length - 1] = { ...last, ...updates };
  }
  return updated;
}

export function useAiChat() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    abortRef.current = new AbortController();

    const userMessage: AiMessage = { role: "user", content };
    const assistantMessage: AiMessage = {
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);
    setError(null);

    try {
      await fetchEventSource(
        `${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION_NAME}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            "X-Session-ID": sessionIdRef.current,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortRef.current.signal,

          async onopen(response) {
            const contentType = response.headers.get("content-type");

            if (!response.ok) {
              if (contentType?.includes("text/event-stream")) {
                const text = await response.text();
                const dataMatch = text.match(/data: (.+)/);
                if (dataMatch) {
                  try {
                    const errorData = JSON.parse(dataMatch[1]);
                    const message = errorData.error?.message;
                    if (message) throw new Error(message);
                  } catch (parseError) {
                    if (
                      parseError instanceof Error &&
                      parseError.message !== "Unexpected token"
                    ) {
                      throw parseError;
                    }
                  }
                }
              }

              if (contentType?.includes("application/json")) {
                const errorData = await response.json();
                throw new Error(
                  errorData.error?.message ||
                    errorData.error ||
                    `Falha na requisição: ${response.status}`,
                );
              }

              throw new Error(`Falha na requisição: ${response.status}`);
            }

            if (!contentType?.includes("text/event-stream")) {
              throw new Error(
                `Formato inesperado de resposta: ${contentType ?? "desconhecido"}`,
              );
            }
          },

          onmessage(event) {
            if (!event.data || event.data === "[DONE]") return;

            let data: {
              error?: { message?: string; type?: string };
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
            };
            try {
              data = JSON.parse(event.data);
            } catch {
              return;
            }

            if (data.error) {
              const errorMsg = userFacingError(
                data.error.type,
                data.error.message ?? "Erro do serviço",
              );
              setError(errorMsg);
              setMessages((prev) => prev.slice(0, -1));
              setIsLoading(false);
              return;
            }

            const choice = data.choices?.[0];
            if (!choice) return;

            if (choice.delta?.content) {
              setMessages((prev) =>
                updateLastAssistant(prev, {
                  content: (prev[prev.length - 1]?.content ?? "") +
                    (choice.delta?.content ?? ""),
                }),
              );
            }

            if (choice.finish_reason) {
              setMessages((prev) =>
                updateLastAssistant(prev, { isStreaming: false }),
              );
            }
          },

          onerror(err) {
            throw err;
          },
        },
      );
    } catch (err) {
      const e = err as Error;
      if (e.name !== "AbortError") {
        setError(e.message || "Não foi possível enviar a mensagem.");
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    sessionIdRef.current = crypto.randomUUID();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, error, sendMessage, cancel, resetChat };
}
