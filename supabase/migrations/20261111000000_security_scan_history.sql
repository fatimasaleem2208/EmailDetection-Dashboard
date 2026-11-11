-- Additional histories only. Existing public.scans and its rows are unchanged.
CREATE TABLE IF NOT EXISTS public.security_scan_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 scan_type text NOT NULL CHECK (scan_type IN ('url','attachment')),
 target text NOT NULL,
 risk_level text NOT NULL CHECK (risk_level IN ('low','caution','high','unknown')),
 risk_score integer CHECK (risk_score BETWEEN 0 AND 100),
 findings jsonb NOT NULL DEFAULT '[]'::jsonb,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_scan_history_user_time_idx ON public.security_scan_history(user_id, created_at DESC);
ALTER TABLE public.security_scan_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,DELETE ON public.security_scan_history TO authenticated;
GRANT ALL ON public.security_scan_history TO service_role;
DROP POLICY IF EXISTS security_scan_history_select_own ON public.security_scan_history;
DROP POLICY IF EXISTS security_scan_history_insert_own ON public.security_scan_history;
DROP POLICY IF EXISTS security_scan_history_delete_own ON public.security_scan_history;
CREATE POLICY security_scan_history_select_own ON public.security_scan_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY security_scan_history_insert_own ON public.security_scan_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY security_scan_history_delete_own ON public.security_scan_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
