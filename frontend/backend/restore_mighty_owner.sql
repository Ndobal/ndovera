-- Restore Mighty School's owner account.
--
-- On 2026-05-21 Genesis's owner used Add Person on ndobalamwilliams@gmail.com, an email that
-- already belonged to Mighty School's owner. Because users.email is globally unique and the
-- ON CONFLICT(email) upsert rewrites tenantId, that single action moved the account into
-- Genesis and overwrote its shared settings blob. Every login since resolved to Genesis.
--
-- Mighty  = tenant_1777923351663_rpozrt
-- Genesis = tenant_1778596336746_l50607

UPDATE users
SET tenantId = 'tenant_1777923351663_rpozrt',
    role = 'owner',
    primary_role = 'owner',
    employment_category = 'administrative',
    status = 'active'
WHERE id = 'user_1779366424868_mjoerd';

UPDATE settings
SET payload = json_set(
      payload,
      '$.tenantId', 'tenant_1777923351663_rpozrt',
      '$.schoolId', 'tenant_1777923351663_rpozrt',
      '$.status', 'active',
      '$.tenantStatus', 'active',
      '$.role', 'owner',
      '$.primaryRole', 'owner',
      '$.roles', json('["owner"]')
    )
WHERE studentId = 'ndobalamwilliams@gmail.com';

-- Drop the owner/teacher/hos grants this account picked up inside Genesis.
DELETE FROM user_roles WHERE user_id = 'user_1779366424868_mjoerd';

INSERT OR REPLACE INTO user_roles (id, tenant_id, user_id, role, is_primary, created_at, updated_at)
VALUES (
  'userrole_tenant_1777923351663_rpozrt_user_1779366424868_mjoerd_owner',
  'tenant_1777923351663_rpozrt',
  'user_1779366424868_mjoerd',
  'owner',
  1,
  '2026-08-10T00:00:00.000Z',
  '2026-08-10T00:00:00.000Z'
);
