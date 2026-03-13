import { supabase, handleSupabaseError } from './client';

export interface NotificationPreferences {
  reminder_days_before: number;
  push_enabled: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('reminder_days_before, push_enabled')
    .maybeSingle();

  if (error) throw new Error(handleSupabaseError(error));
  return data as NotificationPreferences | null;
}

export async function saveNotificationPreferences(
  prefs: NotificationPreferences
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: user.id,
        reminder_days_before: prefs.reminder_days_before,
        push_enabled: prefs.push_enabled,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id' }
    );

  if (error) throw new Error(handleSupabaseError(error));
}
