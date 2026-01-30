-- =============================================
-- Migración: Auto-crear perfil en registro
-- =============================================

-- Función que crea perfil automáticamente cuando un usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, dni, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'lender'),
    NEW.raw_user_meta_data->>'dni',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta después de insertar un usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Permitir que el sistema (service_role) pueda insertar perfiles
-- Esto es necesario porque el trigger se ejecuta con SECURITY DEFINER
GRANT USAGE ON SCHEMA public TO postgres, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
