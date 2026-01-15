-- Створюємо RPC функцію для відхилення рахунку (SECURITY DEFINER)
-- Ця функція обходить RLS і гарантовано виконує відхилення

CREATE OR REPLACE FUNCTION public.reject_purchase_invoice(
    p_invoice_id uuid,
    p_role text,
    p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_invoice record;
    v_result jsonb;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Validate role parameter
    IF p_role NOT IN ('COO', 'CEO') THEN
        RAISE EXCEPTION 'Invalid role: %. Must be COO or CEO', p_role;
    END IF;
    
    -- Validate comment is not empty
    IF p_comment IS NULL OR trim(p_comment) = '' THEN
        RAISE EXCEPTION 'Rejection comment is required';
    END IF;
    
    -- Check user has the claimed role
    IF p_role = 'COO' AND NOT public.has_role(v_user_id, 'coo'::app_role) AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
        RAISE EXCEPTION 'User does not have COO role';
    END IF;
    
    IF p_role = 'CEO' AND NOT public.has_role(v_user_id, 'ceo'::app_role) AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
        RAISE EXCEPTION 'User does not have CEO role';
    END IF;
    
    -- Fetch and lock the invoice
    SELECT * INTO v_invoice 
    FROM public.purchase_invoices 
    WHERE id = p_invoice_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
    END IF;
    
    -- Check invoice is in approval status
    IF v_invoice.status NOT IN ('PENDING_COO', 'PENDING_CEO') THEN
        RAISE EXCEPTION 'Invoice is not pending approval. Current status: %', v_invoice.status;
    END IF;
    
    -- Perform the rejection update
    IF p_role = 'COO' THEN
        UPDATE public.purchase_invoices
        SET
            status = 'DRAFT',
            coo_decision = 'PENDING',
            coo_decided_by = NULL,
            coo_decided_at = NULL,
            coo_comment = p_comment,
            ceo_decision = 'PENDING',
            ceo_decided_by = NULL,
            ceo_decided_at = NULL,
            ceo_comment = NULL,
            updated_at = now()
        WHERE id = p_invoice_id;
    ELSE
        UPDATE public.purchase_invoices
        SET
            status = 'DRAFT',
            coo_decision = 'PENDING',
            coo_decided_by = NULL,
            coo_decided_at = NULL,
            coo_comment = NULL,
            ceo_decision = 'PENDING',
            ceo_decided_by = NULL,
            ceo_decided_at = NULL,
            ceo_comment = p_comment,
            updated_at = now()
        WHERE id = p_invoice_id;
    END IF;
    
    -- Log the rejection event
    PERFORM public.log_purchase_event(
        'INVOICE'::purchase_log_entity_type,
        p_invoice_id,
        p_role || '_REJECTED',
        p_comment,
        NULL
    );
    
    -- Return updated invoice
    SELECT jsonb_build_object(
        'id', id,
        'number', number,
        'status', status,
        'coo_decision', coo_decision,
        'coo_decided_by', coo_decided_by,
        'coo_decided_at', coo_decided_at,
        'coo_comment', coo_comment,
        'ceo_decision', ceo_decision,
        'ceo_decided_by', ceo_decided_by,
        'ceo_decided_at', ceo_decided_at,
        'ceo_comment', ceo_comment
    ) INTO v_result
    FROM public.purchase_invoices
    WHERE id = p_invoice_id;
    
    RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.reject_purchase_invoice(uuid, text, text) TO authenticated;