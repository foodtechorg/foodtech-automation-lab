-- Додаємо колонку phone до profiles
ALTER TABLE public.profiles 
ADD COLUMN phone TEXT;

-- Додаємо CHECK constraint для валідації формату +380XXXXXXXXX
ALTER TABLE public.profiles
ADD CONSTRAINT check_phone_format 
CHECK (phone IS NULL OR phone ~ '^\+380[0-9]{9}$');

-- Оновлюємо функцію handle_new_user для підтримки phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'sales_manager');
  RETURN NEW;
END;
$$;