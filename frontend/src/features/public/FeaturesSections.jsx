import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getRoleSidebarItems } from '../../shared/components/Sidebar';
import { buildFeatureGroups, HOME_FEATURES, menuFeatureNames } from './featureCatalogue';
import './featuresSections.css';

// The public list of features: a few on the home page, all of them on /features. Names only.

const parse = value => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || '{}') || {}; } catch { return {}; }
};

/** The list as it stands now, with Ami's changes from the "features" website section. */
export function useFeatureGroups(section) {
  return useMemo(() => {
    const metadata = parse(section?.metadata);
    return buildFeatureGroups({ menuNames: menuFeatureNames(getRoleSidebarItems), added: metadata.added, hidden: metadata.hidden });
  }, [section]);
}

export function HomeFeatures({ section }) {
  const groups = useFeatureGroups(section);
  const total = groups.reduce((sum, group) => sum + group.names.length, 0);
  const visible = new Set(groups.flatMap(group => group.names));
  return (
    <section aria-label="Features" className="rounded-[2rem] border border-[#c9a96e]/45 bg-white p-6 text-[#191970] shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-white sm:p-8">
      <h2 className="text-2xl font-black sm:text-3xl">What schools get on Ndovera</h2>
      <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {HOME_FEATURES.filter(name => visible.has(name)).map(name => (
          <li key={name} className="flex items-center gap-2 rounded-2xl bg-[#f3f6ff] px-4 py-3 text-sm font-bold text-[#191970] dark:bg-white/10 dark:text-white"><span aria-hidden="true" className="text-[#1a5c38] dark:text-emerald-300">✓</span>{name}</li>
        ))}
      </ul>
      <Link to="/features" className="mt-6 inline-block rounded-full bg-[#191970] px-7 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-[#191970]">Read more: all {total} features</Link>
    </section>
  );
}

export function FeaturesPageBody({ section }) {
  const groups = useFeatureGroups(section);
  return (
    <div className="space-y-8">
      <nav aria-label="Feature groups" className="flex flex-wrap gap-2">
        {groups.map(group => <a key={group.key} href={`#${group.key}`} className="rounded-full border border-[#191970]/25 bg-white px-4 py-2 text-sm font-bold text-[#191970] transition-colors hover:bg-[#191970] hover:text-white dark:border-white/20 dark:bg-slate-900 dark:text-white">{group.title}</a>)}
      </nav>
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((group, index) => (
          <section key={group.key} id={group.key} aria-label={group.title} style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }} className="ndv-feature-group scroll-mt-28 rounded-[2rem] border border-[#c9a96e]/45 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-xl font-black text-[#800000] dark:text-amber-200">{group.title}</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {group.names.map(name => <li key={name} className="flex items-start gap-2 text-sm font-semibold text-[#191970] dark:text-slate-100"><span aria-hidden="true" className="text-[#1a5c38] dark:text-emerald-300">✓</span><span>{name}</span></li>)}
            </ul>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/pricing" className="rounded-full bg-[#191970] px-7 py-3 text-sm font-black text-white dark:bg-white dark:text-[#191970]">See pricing</Link>
      </div>
    </div>
  );
}
