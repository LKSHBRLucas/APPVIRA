import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  createSession,
  insertSessionEvent,
  updateSession,
  type SessionInput,
  type SessionRow,
  type SessionEventType,
} from "@/lib/data/sessions";

export function useSessionMutations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["tasks", user?.id] });
  };

  const start = useMutation({
    mutationFn: async (input: SessionInput) => {
      const session = await createSession(user!.id, input);
      return { session, userId: user!.id };
    },
    onSuccess: invalidate,
  });

  const logEvent = useMutation({
    mutationFn: ({
      sessionId,
      type,
      payload,
    }: {
      sessionId: string;
      type: SessionEventType;
      payload?: Record<string, unknown>;
    }) => insertSessionEvent(user!.id, sessionId, type, payload),
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SessionRow> }) =>
      updateSession(id, patch),
    onSuccess: invalidate,
  });

  return { start, logEvent, patch };
}
