-- RPC: intereses ganados por mes para el lender autenticado
-- Usada por el Dashboard avanzado (feature Pro)
CREATE OR REPLACE FUNCTION get_monthly_interest_earned()
RETURNS TABLE (
  year           int,
  month          int,
  currency       text,
  total_interest numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(YEAR  FROM p.paid_date::date)::int  AS year,
    EXTRACT(MONTH FROM p.paid_date::date)::int  AS month,
    l.currency,
    SUM(p.interest_portion)                     AS total_interest
  FROM payments p
  JOIN loans    l ON l.id = p.loan_id
  WHERE
    p.status     = 'paid'
    AND p.paid_date IS NOT NULL
    AND l.lender_id = auth.uid()
  GROUP BY 1, 2, 3
  ORDER BY 1 ASC, 2 ASC, 3 ASC;
$$;
