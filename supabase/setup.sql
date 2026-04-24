/*create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  stock integer not null default 0 check (stock >= 0),
  price_in numeric(14,2) not null default 0,
  price_out numeric(14,2) not null default 0,
  image_url text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists customer text;
alter table public.orders add column if not exists status text not null default 'PENDING';
alter table public.orders add column if not exists created_at timestamptz not null default now();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id) on update cascade,
  qty integer not null default 1 check (qty > 0),
  sale_price numeric(14,2) not null default 0,
  cost_price numeric(14,2) not null default 0,
  factory_qty integer not null default 0 check (factory_qty >= 0),
  factory_status text not null default 'RECEIVED',
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'product_id'
  ) then
    insert into public.order_items (
      order_id,
      product_id,
      qty,
      sale_price,
      cost_price,
      factory_qty,
      factory_status
    )
    select
      o.id,
      o.product_id,
      1,
      coalesce(p.price_out, 0),
      coalesce(p.price_in, 0),
      case when coalesce(p.stock, 0) <= 0 and o.status not in ('COMPLETED','CANCELLED','RETURNED') then 1 else 0 end,
      case when coalesce(p.stock, 0) <= 0 and o.status not in ('COMPLETED','CANCELLED','RETURNED') then 'NEED_ORDER' else 'RECEIVED' end
    from public.orders o
    join public.products p on p.id = o.product_id
    where not exists (
      select 1 from public.order_items oi where oi.order_id = o.id
    );
  end if;
end $$;

alter table public.orders drop column if exists product_id;

create table if not exists public.revenue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  profit numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'revenue_order_id_unique'
      and conrelid = 'public.revenue'::regclass
  ) then
    alter table public.revenue add constraint revenue_order_id_unique unique (order_id);
  end if;
exception when duplicate_object then
  null;
end $$;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.revenue enable row level security;

drop policy if exists products_all_public on public.products;
drop policy if exists orders_all_public on public.orders;
drop policy if exists order_items_all_public on public.order_items;
drop policy if exists revenue_all_public on public.revenue;

create policy products_all_public on public.products
for all using (true) with check (true);

create policy orders_all_public on public.orders
for all using (true) with check (true);

create policy order_items_all_public on public.order_items
for all using (true) with check (true);

create policy revenue_all_public on public.revenue
for all using (true) with check (true);

drop policy if exists product_images_read_public on storage.objects;
drop policy if exists product_images_insert_public on storage.objects;
drop policy if exists product_images_update_public on storage.objects;
drop policy if exists product_images_delete_public on storage.objects;

create policy product_images_read_public on storage.objects
for select using (bucket_id = 'product-images');

create policy product_images_insert_public on storage.objects
for insert with check (bucket_id = 'product-images');

create policy product_images_update_public on storage.objects
for update using (bucket_id = 'product-images') with check (bucket_id = 'product-images');

create policy product_images_delete_public on storage.objects
for delete using (bucket_id = 'product-images');

create or replace function public.refresh_order_factory_status(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_has_ordered boolean;
begin
  select status into v_status from public.orders where id = p_order_id;

  if v_status in ('DELIVERING', 'COMPLETED', 'RETURNED', 'CANCELLED') then
    return;
  end if;

  select exists (
    select 1
    from public.order_items
    where order_id = p_order_id
      and factory_qty > 0
      and factory_status = 'ORDERED'
  ) into v_has_ordered;

  update public.orders
  set status = case when v_has_ordered then 'FACTORY_ORDERED' else 'PENDING' end
  where id = p_order_id;
end;
$$;

create or replace function public.create_order_tx(p_customer text, p_items jsonb)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_stock integer;
  v_price_in numeric(14,2);
  v_price_out numeric(14,2);
  v_factory_qty integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Don hang phai co it nhat 1 san pham.';
  end if;

  insert into public.orders(customer, status)
  values (p_customer, 'PENDING')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := coalesce(v_item->>'productId', v_item->>'product_id');
    v_qty := greatest(coalesce((v_item->>'qty')::integer, 1), 1);

    select stock, price_in, price_out
    into v_stock, v_price_in, v_price_out
    from public.products
    where id = v_product_id;

    if v_stock is null then
      raise exception 'Khong tim thay san pham %.', v_product_id;
    end if;

    v_factory_qty := greatest(v_qty - v_stock, 0);

    insert into public.order_items(
      order_id,
      product_id,
      qty,
      sale_price,
      cost_price,
      factory_qty,
      factory_status
    ) values (
      v_order_id,
      v_product_id,
      v_qty,
      v_price_out,
      v_price_in,
      v_factory_qty,
      case when v_factory_qty > 0 then 'NEED_ORDER' else 'RECEIVED' end
    );
  end loop;

  perform public.refresh_order_factory_status(v_order_id);
  return v_order_id;
end;
$$;

create or replace function public.update_order_tx(p_order_id uuid, p_customer text, p_items jsonb)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_stock integer;
  v_price_in numeric(14,2);
  v_price_out numeric(14,2);
  v_factory_qty integer;
begin
  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if v_status is null then
    raise exception 'Khong tim thay don hang.';
  end if;

  if v_status not in ('PENDING', 'FACTORY_ORDERED') then
    raise exception 'Chi duoc sua don truoc khi giao hang hoac truoc khi ket thuc.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Don hang phai co it nhat 1 san pham.';
  end if;

  update public.orders
  set customer = p_customer,
      status = 'PENDING'
  where id = p_order_id;

  delete from public.order_items where order_id = p_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := coalesce(v_item->>'productId', v_item->>'product_id');
    v_qty := greatest(coalesce((v_item->>'qty')::integer, 1), 1);

    select stock, price_in, price_out
    into v_stock, v_price_in, v_price_out
    from public.products
    where id = v_product_id;

    if v_stock is null then
      raise exception 'Khong tim thay san pham %.', v_product_id;
    end if;

    v_factory_qty := greatest(v_qty - v_stock, 0);

    insert into public.order_items(
      order_id,
      product_id,
      qty,
      sale_price,
      cost_price,
      factory_qty,
      factory_status
    ) values (
      p_order_id,
      v_product_id,
      v_qty,
      v_price_out,
      v_price_in,
      v_factory_qty,
      case when v_factory_qty > 0 then 'NEED_ORDER' else 'RECEIVED' end
    );
  end loop;

  perform public.refresh_order_factory_status(p_order_id);
end;
$$;

create or replace function public.mark_factory_ordered_tx(p_order_item_id uuid)
returns void
language plpgsql
as $$
declare
  v_order_id uuid;
  v_factory_qty integer;
begin
  select order_id, factory_qty
  into v_order_id, v_factory_qty
  from public.order_items
  where id = p_order_item_id
  for update;

  if v_order_id is null then
    raise exception 'Khong tim thay dong san pham.';
  end if;

  if v_factory_qty <= 0 then
    raise exception 'Dong san pham nay khong can dat nha may.';
  end if;

  update public.order_items
  set factory_status = 'ORDERED'
  where id = p_order_item_id;

  perform public.refresh_order_factory_status(v_order_id);
end;
$$;

create or replace function public.reset_factory_item_tx(p_order_item_id uuid)
returns void
language plpgsql
as $$
declare
  v_order_id uuid;
begin
  select order_id into v_order_id
  from public.order_items
  where id = p_order_item_id
  for update;

  if v_order_id is null then
    raise exception 'Khong tim thay dong san pham.';
  end if;

  update public.order_items
  set factory_status = 'NEED_ORDER'
  where id = p_order_item_id
    and factory_qty > 0;

  perform public.refresh_order_factory_status(v_order_id);
end;
$$;

create or replace function public.receive_factory_item_tx(p_order_item_id uuid)
returns void
language plpgsql
as $$
declare
  v_order_id uuid;
  v_product_id text;
  v_factory_qty integer;
  v_factory_status text;
begin
  select order_id, product_id, factory_qty, factory_status
  into v_order_id, v_product_id, v_factory_qty, v_factory_status
  from public.order_items
  where id = p_order_item_id
  for update;

  if v_order_id is null then
    raise exception 'Khong tim thay dong san pham.';
  end if;

  if v_factory_qty <= 0 then
    raise exception 'Dong san pham nay khong co so luong can nhap.';
  end if;

  if v_factory_status <> 'ORDERED' then
    raise exception 'Chi nhan hang sau khi da order nha may.';
  end if;

  update public.products
  set stock = stock + v_factory_qty
  where id = v_product_id;

  update public.order_items
  set factory_status = 'RECEIVED'
  where id = p_order_item_id;

  perform public.refresh_order_factory_status(v_order_id);
end;
$$;

create or replace function public.start_delivery_tx(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_rec record;
  v_stock integer;
begin
  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if v_status is null then
    raise exception 'Khong tim thay don hang.';
  end if;

  if v_status not in ('PENDING', 'FACTORY_ORDERED') then
    raise exception 'Chi don dang xu ly moi duoc giao hang.';
  end if;

  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'Don hang chua co san pham.';
  end if;

  for v_rec in
    select product_id, sum(qty)::integer as qty
    from public.order_items
    where order_id = p_order_id
    group by product_id
  loop
    select stock into v_stock
    from public.products
    where id = v_rec.product_id
    for update;

    if v_stock < v_rec.qty then
      raise exception 'San pham % chua du ton kho de giao. Ton hien tai %, can %.', v_rec.product_id, v_stock, v_rec.qty;
    end if;
  end loop;

  for v_rec in
    select product_id, sum(qty)::integer as qty
    from public.order_items
    where order_id = p_order_id
    group by product_id
  loop
    update public.products
    set stock = stock - v_rec.qty
    where id = v_rec.product_id;
  end loop;

  update public.orders
  set status = 'DELIVERING'
  where id = p_order_id;
end;
$$;

create or replace function public.complete_order_tx(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_amount numeric(14,2);
  v_profit numeric(14,2);
begin
  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if v_status is null then
    raise exception 'Khong tim thay don hang.';
  end if;

  if v_status <> 'DELIVERING' then
    raise exception 'Chi don dang giao moi duoc hoan tat.';
  end if;

  select
    coalesce(sum(sale_price * qty), 0),
    coalesce(sum((sale_price - cost_price) * qty), 0)
  into v_amount, v_profit
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set status = 'COMPLETED'
  where id = p_order_id;

  insert into public.revenue(order_id, amount, profit)
  values (p_order_id, v_amount, v_profit)
  on conflict (order_id) do update
  set amount = excluded.amount,
      profit = excluded.profit,
      created_at = now();
end;
$$;

create or replace function public.return_order_tx(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_rec record;
begin
  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if v_status is null then
    raise exception 'Khong tim thay don hang.';
  end if;

  if v_status <> 'DELIVERING' then
    raise exception 'Chi don dang giao moi duoc danh dau that bai/hoan hang.';
  end if;

  for v_rec in
    select product_id, sum(qty)::integer as qty
    from public.order_items
    where order_id = p_order_id
    group by product_id
  loop
    update public.products
    set stock = stock + v_rec.qty
    where id = v_rec.product_id;
  end loop;

  delete from public.revenue where order_id = p_order_id;

  update public.orders
  set status = 'RETURNED'
  where id = p_order_id;
end;
$$;
