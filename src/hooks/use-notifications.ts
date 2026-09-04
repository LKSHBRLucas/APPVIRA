import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  insertNotification,
  listNotifications,
  markNotificationRead,
  type NotificationInput,
} from "@/lib/data/notifications";

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: !!user,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });

  const create = useMutation({
    mutationFn: (input: NotificationInput) =>
      insertNotification(user!.id, input),
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    create,
    markRead,
  };
}
