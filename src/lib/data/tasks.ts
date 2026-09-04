import { supabase } from "@/integrations/supabase/client";

export interface TaskRow {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  category: string;
  first_step: string | null;
  scheduled_at: string | null;
  duration_min: number;
  status: "planned" | "done" | "abandoned";
  sort_order: number;
  created_at: string;
  completed_at: string | null;
}

export interface TaskWithGoal extends TaskRow {
  goals: { id: string; title: string; category: string } | null;
}

export type TaskInput = Pick<
  TaskRow,
  "title" | "category" | "first_step" | "scheduled_at" | "duration_min" | "goal_id"
>;

export async function listTasks(userId: string): Promise<TaskWithGoal[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, goals(id, title, category)")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaskWithGoal[];
}

export async function getTask(taskId: string): Promise<TaskWithGoal | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, goals(id, title, category)")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  return data as TaskWithGoal | null;
}

export async function createTask(
  userId: string,
  input: TaskInput,
): Promise<TaskRow> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function updateTask(
  taskId: string,
  patch: Partial<TaskRow>,
): Promise<TaskRow | null> {
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", taskId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as TaskRow | null;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

/** Mark a task as done; `doneAt` defaults to now. */
export async function completeTask(
  taskId: string,
  doneAt = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "done", completed_at: doneAt })
    .eq("id", taskId);
  if (error) throw error;
}
