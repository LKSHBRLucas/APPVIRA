import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type TaskInput,
  type TaskRow,
} from "@/lib/data/tasks";

export function useTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: () => listTasks(user!.id),
    enabled: !!user,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["tasks", user?.id] });

  const create = useMutation({
    mutationFn: (input: TaskInput) => createTask(user!.id, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TaskRow> }) =>
      updateTask(id, patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: (id: string) => completeTask(id),
    onSuccess: invalidate,
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
    complete,
  };
}
