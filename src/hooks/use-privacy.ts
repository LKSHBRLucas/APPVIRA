import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  getPrivacySettings,
  updatePrivacySettings,
  type PrivacySettingsRow,
} from "@/lib/data/consents";

export function usePrivacy() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["privacy", user?.id],
    queryFn: () => getPrivacySettings(user!.id),
    enabled: !!user,
  });

  const update = useMutation({
    mutationFn: (patch: Partial<PrivacySettingsRow>) =>
      updatePrivacySettings(user!.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["privacy", user?.id] });
    },
  });

  return { settings: query.data, isLoading: query.isLoading, update };
}
