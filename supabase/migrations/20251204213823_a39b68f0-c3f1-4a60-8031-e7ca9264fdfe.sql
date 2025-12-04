-- Enums
CREATE TYPE public.app_role AS ENUM ('sales_manager', 'rd_dev', 'rd_manager', 'admin');
CREATE TYPE public.client_result AS ENUM ('PRODUCTION', 'REWORK', 'DECLINE');
CREATE TYPE public.direction AS ENUM ('FUNCTIONAL', 'FLAVOR', 'COLORANT', 'COMPLEX');
CREATE TYPE public.domain AS ENUM ('MEAT', 'CONFECTIONERY', 'DAIRY', 'BAKERY', 'FISH', 'FATS_OILS', 'ICE_CREAM', 'SEMI_FINISHED');
CREATE TYPE public.event_type AS ENUM ('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'FEEDBACK_ADDED', 'FIELD_UPDATED', 'SENT_FOR_TEST', 'PRODUCTION_SET', 'FEEDBACK_PROVIDED');
CREATE TYPE public.priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE public.status AS ENUM ('PENDING', 'IN_PROGRESS', 'SENT_FOR_TEST', 'APPROVED_FOR_PRODUCTION', 'REJECTED_BY_CLIENT', 'CANCELLED');

-- Tables FIRST
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    name text,
    role public.app_role DEFAULT 'sales_manager'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

CREATE TABLE public.requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    code text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    author_email text NOT NULL,
    customer_company text NOT NULL,
    customer_contact text,
    direction public.direction NOT NULL,
    domain public.domain NOT NULL,
    description text NOT NULL,
    desired_due_date timestamp with time zone,
    priority public.priority DEFAULT 'MEDIUM'::public.priority NOT NULL,
    responsible_email text,
    eta_first_stage timestamp with time zone,
    rd_comment text,
    date_sent_for_test timestamp with time zone,
    status public.status DEFAULT 'PENDING'::public.status NOT NULL,
    customer_feedback text,
    customer_result public.client_result,
    production_start_date timestamp with time zone,
    final_product_name text,
    has_sample_analog boolean DEFAULT false NOT NULL
);

CREATE TABLE public.request_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    actor_email text NOT NULL,
    event_type public.event_type NOT NULL,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Functions AFTER tables
CREATE FUNCTION public.generate_request_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)), 0) + 1
  INTO next_number FROM public.requests;
  new_code := 'RD-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_code;
END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE FUNCTION public.log_request_event(p_request_id uuid, p_actor_email text, p_event_type public.event_type, p_payload jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $$
DECLARE event_id uuid;
BEGIN
  INSERT INTO public.request_events (request_id, actor_email, event_type, payload)
  VALUES (p_request_id, p_actor_email, p_event_type, p_payload)
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'sales_manager');
  RETURN NEW;
END;
$$;

-- Indexes
CREATE INDEX idx_requests_author_email ON public.requests(author_email);
CREATE INDEX idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX idx_requests_responsible_email ON public.requests(responsible_email);
CREATE INDEX idx_requests_status_priority ON public.requests(status, priority);
CREATE INDEX idx_request_events_request_id_created_at ON public.request_events(request_id, created_at DESC);

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Sales managers can create requests" ON public.requests FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'sales_manager') AND author_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Sales managers can view own requests" ON public.requests FOR SELECT TO authenticated 
USING ((public.has_role(auth.uid(), 'sales_manager') AND author_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
  OR public.has_role(auth.uid(), 'rd_dev') OR public.has_role(auth.uid(), 'rd_manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "R&D can update requests" ON public.requests FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'rd_manager') OR public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'rd_dev') AND (responsible_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR responsible_email IS NULL)));

CREATE POLICY "Sales can update own requests feedback" ON public.requests FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'sales_manager') AND author_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Authenticated users can create events" ON public.request_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view events for accessible requests" ON public.request_events FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_events.request_id 
  AND (public.has_role(auth.uid(), 'rd_dev') OR public.has_role(auth.uid(), 'rd_manager') OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'sales_manager') AND r.author_email = (SELECT email FROM public.profiles WHERE id = auth.uid())))));