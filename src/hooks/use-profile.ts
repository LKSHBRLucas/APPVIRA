import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  getProfile,
  updateProfile,
  type ProfileRow,
} from "@/lib/data/profiles";

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });

  const update = useMutation({
    mutationFn: (patch: Partial<ProfileRow>) =>
      updateProfile(user!.id, patch),
    onSuccess: (data) => {
      queryClient.setQueryData(["profile", user?.id], data);
    },
  });

  return { profile: query.data, isLoading: query.isLoading, update };
}
