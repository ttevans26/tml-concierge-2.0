
-- ========== Concierge conversations ==========
CREATE TABLE public.concierge_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trip_id uuid,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concierge_conversations TO authenticated;
GRANT ALL ON public.concierge_conversations TO service_role;

ALTER TABLE public.concierge_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own conversations" ON public.concierge_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON public.concierge_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.concierge_conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON public.concierge_conversations
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_concierge_conv_updated_at
  BEFORE UPDATE ON public.concierge_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== Concierge messages ==========
CREATE TABLE public.concierge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.concierge_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concierge_messages TO authenticated;
GRANT ALL ON public.concierge_messages TO service_role;

ALTER TABLE public.concierge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own messages" ON public.concierge_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.concierge_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.concierge_messages
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_concierge_messages_conversation ON public.concierge_messages(conversation_id, created_at);

-- ========== Notifications ==========
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trip_id uuid,
  item_id uuid,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  is_dismissed boolean NOT NULL DEFAULT false,
  due_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);
-- Inserts are service_role only (edge function) — no INSERT policy for authenticated.

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, is_dismissed, created_at DESC);

-- ========== Profile: notification preferences ==========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT
    '{"cancellation_lead_days":[7,3,1]}'::jsonb;
