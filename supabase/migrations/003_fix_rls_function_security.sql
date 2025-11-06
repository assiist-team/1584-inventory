-- Fix security warnings: Set search_path for SECURITY DEFINER functions
-- This prevents search path injection attacks

CREATE OR REPLACE FUNCTION is_system_owner() RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION is_account_member(account_id_param uuid) RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = account_id_param AND user_id = auth.uid()
  ) OR public.is_system_owner();
$$;

CREATE OR REPLACE FUNCTION get_user_role_in_account(account_id_param uuid) RETURNS text 
LANGUAGE sql 
STABLE 
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT role FROM public.account_members
  WHERE account_id = account_id_param AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_account_admin(account_id_param uuid) RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.is_system_owner() OR (
    public.is_account_member(account_id_param) AND
    public.get_user_role_in_account(account_id_param) = 'admin'
  );
$$;

