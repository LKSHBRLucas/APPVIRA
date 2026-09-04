import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getSubscription, setPlan } from "@/lib/data/subscriptions";

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: () => getSubscription(user!.id),
    enabled: !!user,
  });

  const changePlan = useMutation({
    mutationFn: (plan: "free" | "premium") => setPlan(user!.id, plan),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] }),
  });

  return { subscription: query.data, changePlan };
}
