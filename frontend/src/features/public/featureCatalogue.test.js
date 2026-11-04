jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/', search: '' }), useNavigate: () => () => {}, NavLink: () => null }), { virtual: true });
jest.mock('../../shared/hooks/useFeatureFlags', () => () => ({ featureFlags: {} }));
jest.mock('../../shared/hooks/useTenantPwaManifest', () => ({ getTenantPwaInfo: () => null }));
jest.mock('../submissions/StaffSubmissionPanel', () => () => null);

import { buildFeatureGroups, FEATURE_GROUPS, HOME_FEATURES, menuFeatureNames } from './featureCatalogue';
import { getRoleSidebarItems } from '../../shared/components/Sidebar';

const allNames = groups => groups.flatMap(group => group.names);

test('a new page in a role menu appears by itself', () => {
  const getItems = role => (role === 'owner' ? [{ name: 'Overview', path: '/x' }, { name: 'Alumni Network', path: '/roles/owner/alumni' }, { name: 'Submit', path: '#submit' }] : []);
  const groups = buildFeatureGroups({ menuNames: menuFeatureNames(getItems) });
  expect(groups.find(group => group.key === 'more').names).toEqual(['Alumni Network']);
  expect(allNames(groups)).not.toContain('Overview');
});

test('Ami can add a name and hide one', () => {
  const names = allNames(buildFeatureGroups({ added: ['Alumni Network', 'Results'], hidden: ['Payroll'] }));
  expect(names).toContain('Alumni Network');
  expect(names.filter(name => name === 'Results')).toHaveLength(1);
  expect(names).not.toContain('Payroll');
});

test('no name is listed twice, and the home page picks only real names', () => {
  const groups = buildFeatureGroups({ menuNames: menuFeatureNames(getRoleSidebarItems) });
  const names = allNames(groups);
  expect(new Set(names).size).toBe(names.length);
  const curated = FEATURE_GROUPS.flatMap(group => group.names);
  HOME_FEATURES.forEach(name => expect(curated).toContain(name));
});

test('Ndovera staff pages stay off the public list', () => {
  const names = allNames(buildFeatureGroups({ menuNames: menuFeatureNames(getRoleSidebarItems) }));
  ['Shareholders', 'Profit & Loss', 'Country Prices', 'Pass Codes', 'School Outreach', 'Reviews & Home Schools'].forEach(name => expect(names).not.toContain(name));
});
