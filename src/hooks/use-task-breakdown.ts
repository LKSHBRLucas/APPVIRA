import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  generateTaskBreakdown,
  saveTaskBreakdown,
} from "@/lib/data/task-breakdown";

export function useTaskBreakdown() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: ({
      title,
      firstStep,
      note,
    }: {
      title: string;
      firstStep?: string | null;
      note?: string | null;
    }) => generateTaskBreakdown(title, firstStep, note),
  });

  const save = useMutation({
    mutationFn: ({ taskId, steps }: { taskId: string; steps: string[] | null }) =>
      saveTaskBreakdown(taskId, steps),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tasks", user?.id] }),
  });

  return { generate, save };
}
