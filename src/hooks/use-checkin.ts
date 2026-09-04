import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { insertEnergyCheckin, latestEnergy } from "@/lib/data/checkins";

export function useCheckin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["energy", user?.id],
    queryFn: () => latestEnergy(user!.id),
    enabled: !!user,
  });

  const checkin = useMutation({
    mutationFn: (level: number) => insertEnergyCheckin(user!.id, level),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["energy", user?.id] }),
  });

  return { latest: query.data, checkin };
}
