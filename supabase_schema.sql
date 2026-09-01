-- =======================================================
-- SCRIPT SQL COMPLETO PARA O SUPABASE - VISTORIA YZZY
-- Como usar:
-- 1. Abra o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. No menu lateral esquerdo, clique em "SQL Editor"
-- 3. Clique em "New Query", cole todo este código e clique em "RUN" (ou CTRL + ENTER)
-- =======================================================

-- 1. Habilitar extensão de UUID e criptografia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Empresas (Companies / Tenants)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(60) NOT NULL UNIQUE,
    corporate_code VARCHAR(20) NOT NULL UNIQUE,
    trade_name VARCHAR(150) NOT NULL,
    legal_name VARCHAR(200),
    cnpj VARCHAR(18),
    phone VARCHAR(20),
    email VARCHAR(120),
    logo_url TEXT,
    primary_color VARCHAR(10) DEFAULT '#0284c7',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Usuários (Users / Colaboradores)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'ROLE_INSPECTOR',
    password_hash TEXT NOT NULL,
    cpf VARCHAR(14),
    creci VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_company_username UNIQUE (company_id, username)
);

-- Adicionar colunas caso a tabela users já tenha sido criada anteriormente
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS creci VARCHAR(30);

-- 4. Tabela de Vistorias (Inspections)
CREATE TABLE IF NOT EXISTS public.inspections (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    inspection_type TEXT NOT NULL DEFAULT 'Entrada',
    date TEXT,
    inspector_name TEXT,
    tenant_name TEXT,
    property_address TEXT,
    data_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 5. Habilitar e configurar Row Level Security (RLS) permissivo para a API
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir gestao publica de empresas" ON public.companies;
CREATE POLICY "Permitir gestao publica de empresas" ON public.companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir gestao publica de usuarios" ON public.users;
CREATE POLICY "Permitir gestao publica de usuarios" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso publico anonimo para vistorias" ON public.inspections;
CREATE POLICY "Permitir acesso publico anonimo para vistorias" ON public.inspections FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Inserir empresa padrão: Vistoria YZZY
INSERT INTO public.companies (id, slug, corporate_code, trade_name, logo_url)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'vistoria-yzzy',
    'YZZY01',
    'Vistoria YZZY',
    '/logo.jpg'
) ON CONFLICT (corporate_code) DO NOTHING;

-- 7. Inserir usuário Gerente padrão: ricso.biella / 123
INSERT INTO public.users (company_id, username, full_name, role, password_hash)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'ricso.biella',
    'Ricson Biella',
    'ROLE_MANAGER',
    crypt('123', gen_salt('bf'))
) ON CONFLICT (company_id, username) DO NOTHING;
