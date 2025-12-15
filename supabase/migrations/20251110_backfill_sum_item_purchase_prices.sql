-- Backfill sum_item_purchase_prices for existing transactions
-- Sets sum_item_purchase_prices to the sum of purchase_price for items attached to each transaction
update public.transactions t
set sum_item_purchase_prices = coalesce((
  select sum(coalesce(i.purchase_price, '0')::numeric)
  from public.items i
  where i.account_id = t.account_id
    and i.transaction_id = t.transaction_id
), 0);

-- End of backfill script

