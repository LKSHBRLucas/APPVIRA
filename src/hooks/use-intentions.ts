import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  createIntention,
  deleteIntention,
  listIntentions,
  setIntentionActive,
  type IntentionInput,
} from "@/lib/data/intentions";

export function useIntentions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["intentions", user?.id],
    queryFn: () => listIntentions(user!.id),
    enabled: !!user,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["intentions", user?.id] });

  const create = useMutation({
    mutationFn: (input: IntentionInput) => createIntention(user!.id, input),
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setIntentionActive(id, active),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteIntention(id),
    onSuccess: invalidate,
  });

  return {
    intentions: query.data ?? [],
    isLoading: query.isLoading,
    create,
    toggle,
    remove,
  };
}
