-- ============================================
-- Development Module: Recipes & Ingredients
-- Based on docs/TZ_Modul_Rozrobka.md
-- ============================================

-- Create enum for recipe status
CREATE TYPE development_recipe_status AS ENUM ('Draft', 'Locked', 'Archived');

-- Table: development_recipes
CREATE TABLE public.development_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    recipe_seq INTEGER NOT NULL CHECK (recipe_seq >= 1 AND recipe_seq <= 99),
    recipe_code TEXT NOT NULL,
    name TEXT,
    status development_recipe_status NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id),
    
    CONSTRAINT unique_request_recipe_seq UNIQUE (request_id, recipe_seq),
    CONSTRAINT unique_request_recipe_code UNIQUE (request_id, recipe_code)
);

-- Table: development_recipe_ingredients
CREATE TABLE public.development_recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.development_recipes(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    grams NUMERIC(12, 3) NOT NULL CHECK (grams > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dev_recipes_request_id ON public.development_recipes(request_id);
CREATE INDEX idx_dev_recipes_status ON public.development_recipes(status);
CREATE INDEX idx_dev_recipe_ingredients_recipe_id ON public.development_recipe_ingredients(recipe_id);

-- Trigger for updated_at on development_recipes
CREATE TRIGGER set_development_recipes_updated_at
    BEFORE UPDATE ON public.development_recipes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger for updated_at on development_recipe_ingredients
CREATE TRIGGER set_development_recipe_ingredients_updated_at
    BEFORE UPDATE ON public.development_recipe_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.development_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for development_recipes (admin and coo only)
CREATE POLICY "Admin and COO can view development_recipes"
    ON public.development_recipes
    FOR SELECT
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'coo'::app_role)
    );

CREATE POLICY "Admin and COO can create development_recipes"
    ON public.development_recipes
    FOR INSERT
    WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'coo'::app_role)
    );

CREATE POLICY "Admin and COO can update development_recipes"
    ON public.development_recipes
    FOR UPDATE
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'coo'::app_role)
    );

CREATE POLICY "Admin and COO can delete development_recipes"
    ON public.development_recipes
    FOR DELETE
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'coo'::app_role)
    );

-- RLS Policies for development_recipe_ingredients (admin and coo only)
CREATE POLICY "Admin and COO can view development_recipe_ingredients"
    ON public.development_recipe_ingredients
    FOR SELECT
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'coo'::app_role)
    );

CREATE POLICY "Admin and COO can create development_recipe_ingredients"
    ON public.development_recipe_ingredients
    FOR INSERT
    WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'coo'::app_role)
    );

CREATE POLICY "Admin and COO can update development_recipe_ingredients"
    ON public.development_recipe_ingredients
    FOR UPDATE
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'coo'::app_role)
    );

CREATE POLICY "Admin and COO can delete development_recipe_ingredients"
    ON public.development_recipe_ingredients
    FOR DELETE
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'coo'::app_role)
    );

-- RPC: create_development_recipe
-- Uses advisory lock to prevent race conditions in seq generation
CREATE OR REPLACE FUNCTION public.create_development_recipe(p_request_id UUID)
RETURNS public.development_recipes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_code TEXT;
    v_next_seq INTEGER;
    v_recipe_code TEXT;
    v_user_id UUID;
    v_new_recipe public.development_recipes;
BEGIN
    -- Check authorization
    v_user_id := auth.uid();
    IF NOT (has_role(v_user_id, 'admin'::app_role) OR has_role(v_user_id, 'coo'::app_role)) THEN
        RAISE EXCEPTION 'Access denied: requires admin or coo role';
    END IF;

    -- Get advisory lock on request_id to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));

    -- Get request code from requests table
    SELECT code INTO v_request_code
    FROM public.requests
    WHERE id = p_request_id AND status = 'IN_PROGRESS';

    IF v_request_code IS NULL THEN
        RAISE EXCEPTION 'Request not found or not in IN_PROGRESS status';
    END IF;

    -- Calculate next recipe_seq (max + 1, including archived)
    SELECT COALESCE(MAX(recipe_seq), 0) + 1 INTO v_next_seq
    FROM public.development_recipes
    WHERE request_id = p_request_id;

    -- Validate seq limit
    IF v_next_seq > 99 THEN
        RAISE EXCEPTION 'Maximum number of recipes (99) reached for this request';
    END IF;

    -- Generate recipe_code: RD-0004/01
    v_recipe_code := v_request_code || '/' || LPAD(v_next_seq::TEXT, 2, '0');

    -- Insert new recipe
    INSERT INTO public.development_recipes (
        request_id,
        recipe_seq,
        recipe_code,
        status,
        created_by
    ) VALUES (
        p_request_id,
        v_next_seq,
        v_recipe_code,
        'Draft',
        v_user_id
    )
    RETURNING * INTO v_new_recipe;

    RETURN v_new_recipe;
END;
$$;

-- RPC: copy_development_recipe
-- Creates a copy of recipe with all ingredients
CREATE OR REPLACE FUNCTION public.copy_development_recipe(p_recipe_id UUID)
RETURNS public.development_recipes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source_recipe public.development_recipes;
    v_new_recipe public.development_recipes;
    v_request_code TEXT;
    v_next_seq INTEGER;
    v_recipe_code TEXT;
    v_user_id UUID;
    v_new_name TEXT;
BEGIN
    -- Check authorization
    v_user_id := auth.uid();
    IF NOT (has_role(v_user_id, 'admin'::app_role) OR has_role(v_user_id, 'coo'::app_role)) THEN
        RAISE EXCEPTION 'Access denied: requires admin or coo role';
    END IF;

    -- Get source recipe
    SELECT * INTO v_source_recipe
    FROM public.development_recipes
    WHERE id = p_recipe_id;

    IF v_source_recipe IS NULL THEN
        RAISE EXCEPTION 'Source recipe not found';
    END IF;

    -- Get advisory lock on request_id
    PERFORM pg_advisory_xact_lock(hashtext(v_source_recipe.request_id::text));

    -- Get request code
    SELECT code INTO v_request_code
    FROM public.requests
    WHERE id = v_source_recipe.request_id;

    -- Calculate next recipe_seq
    SELECT COALESCE(MAX(recipe_seq), 0) + 1 INTO v_next_seq
    FROM public.development_recipes
    WHERE request_id = v_source_recipe.request_id;

    IF v_next_seq > 99 THEN
        RAISE EXCEPTION 'Maximum number of recipes (99) reached for this request';
    END IF;

    -- Generate new recipe_code
    v_recipe_code := v_request_code || '/' || LPAD(v_next_seq::TEXT, 2, '0');

    -- Generate new name
    IF v_source_recipe.name IS NOT NULL AND v_source_recipe.name != '' THEN
        v_new_name := v_source_recipe.name || ' (копія)';
    ELSE
        v_new_name := NULL;
    END IF;

    -- Insert new recipe
    INSERT INTO public.development_recipes (
        request_id,
        recipe_seq,
        recipe_code,
        name,
        status,
        created_by
    ) VALUES (
        v_source_recipe.request_id,
        v_next_seq,
        v_recipe_code,
        v_new_name,
        'Draft',
        v_user_id
    )
    RETURNING * INTO v_new_recipe;

    -- Copy ingredients
    INSERT INTO public.development_recipe_ingredients (
        recipe_id,
        ingredient_name,
        grams,
        sort_order
    )
    SELECT
        v_new_recipe.id,
        ingredient_name,
        grams,
        sort_order
    FROM public.development_recipe_ingredients
    WHERE recipe_id = p_recipe_id
    ORDER BY sort_order;

    RETURN v_new_recipe;
END;
$$;