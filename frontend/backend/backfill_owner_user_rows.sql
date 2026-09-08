-- Three schools had an owner in `tenants.owner_email` and a settings row, but no `users` row.
-- Login works off settings alone, so these owners could sign in while being invisible to every
-- people list, role check and staff count in their own school. Create the missing rows.
-- Their settings already carry the correct tenantId, so nothing else needs to change.

INSERT INTO users (id, email, name, role, primary_role, employment_category, tenantId, status, createdAt)
VALUES
  ('user_backfill_genesis_owner',  'thegenesisschoolabuja@gmail.com', 'Arc. Pastor Moses Dzungwe', 'owner', 'owner', 'administrative', 'tenant_1778596336746_l50607', 'active', '2026-08-10T00:00:00.000Z'),
  ('user_backfill_wds_owner',      'ndoveraschool@gmail.com',         'Patrick Sam',               'owner', 'owner', 'administrative', 'tenant_1778750026058_d7den8', 'active', '2026-08-10T00:00:00.000Z'),
  ('user_backfill_cotters_owner',  'olayinkasam28@gmail.com',         'Adeniji Samson Olayinka',   'owner', 'owner', 'administrative', 'tenant_1778920612812_ahy0wp', 'active', '2026-08-10T00:00:00.000Z')
ON CONFLICT(email) DO NOTHING;

INSERT OR REPLACE INTO user_roles (id, tenant_id, user_id, role, is_primary, created_at, updated_at)
VALUES
  ('userrole_tenant_1778596336746_l50607_user_backfill_genesis_owner_owner', 'tenant_1778596336746_l50607', 'user_backfill_genesis_owner', 'owner', 1, '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z'),
  ('userrole_tenant_1778750026058_d7den8_user_backfill_wds_owner_owner',     'tenant_1778750026058_d7den8', 'user_backfill_wds_owner',     'owner', 1, '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z'),
  ('userrole_tenant_1778920612812_ahy0wp_user_backfill_cotters_owner_owner', 'tenant_1778920612812_ahy0wp', 'user_backfill_cotters_owner', 'owner', 1, '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z');
