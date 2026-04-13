-- Supabase Database Schema for Car Manager

-- Refuelings table
create table refuelings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  odometer integer,
  volume_gal numeric(10,3),
  price_per_gal numeric(10,3),
  total_cost numeric(10,2),
  distance_mi numeric(10,1),
  full_tank boolean default true,
  fuel_type text default 'Gasoline',
  notes text,
  created_at timestamp with time zone default now()
);

-- Services table
create table services (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  odometer integer,
  description text,
  cost numeric(10,2),
  category text,
  notes text,
  location text,
  created_at timestamp with time zone default now()
);

-- Expenses table
create table expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  odometer integer,
  description text,
  cost numeric(10,2),
  category text,
  notes text,
  created_at timestamp with time zone default now()
);

-- RLS Policies (Single-tenant example)
-- By default, RLS is disabled in this schema script for simplicity,
-- but for a production single-tenant app, you should:
-- 1. Enable RLS: alter table refuelings enable row level security;
-- 2. Add policy: create policy "Allow all for my user" on refuelings
--    using (auth.uid() = 'your-user-uuid-here');
