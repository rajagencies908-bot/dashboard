-- Optional helper RPC for Daily Sales upload history.
-- Run this in Supabase SQL Editor after the earlier Daily Sales setup.

CREATE OR REPLACE FUNCTION public.raj_daily_sales_upload_history(
    p_session_token text,
    p_device_id text
)
RETURNS TABLE(
    upload_type text,
    file_name text,
    uploaded_by text,
    date_from date,
    date_to date,
    total_rows integer,
    uploaded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM public.raj_outstanding_assert_session(p_session_token,p_device_id);

    RETURN QUERY
    SELECT 'Sales'::text, s.file_name, s.uploaded_by, s.date_from, s.date_to,
           s.total_rows, s.uploaded_at
    FROM public.daily_sales_uploads s
    UNION ALL
    SELECT 'Budget'::text, b.file_name, b.uploaded_by, NULL::date, NULL::date,
           b.total_customers, b.uploaded_at
    FROM public.daily_budget_uploads b
    ORDER BY uploaded_at DESC
    LIMIT 100;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.raj_daily_sales_upload_history(text,text)
TO anon, authenticated;
