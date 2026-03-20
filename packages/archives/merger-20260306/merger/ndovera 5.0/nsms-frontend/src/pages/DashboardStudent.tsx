import React from 'react';

const sidebarItems = [
  { label: 'Dashboard', badge: null },
  { label: 'My Subjects', badge: '6' },
  { label: 'Assignments', badge: '3' },
  { label: 'Results', badge: null },
  { label: 'CBT', badge: '2' },
  { label: 'Library', badge: '4' },
  { label: 'Tuckshop', badge: null },
  { label: 'Practice Corner', badge: 'AI' },
  { label: 'Civic Centre', badge: 'Live' },
  { label: 'Messaging', badge: '8' },
  { label: 'Notifications', badge: '12' },
  { label: 'Profile Settings', badge: null },
];

const subjects = [
  { name: 'Mathematics', teacher: 'Mr. Adebayo', due: 'Assignment due in 2 days', materials: 12 },
  { name: 'English', teacher: 'Mrs. Okafor', due: 'Essay due in 5 days', materials: 8 },
  { name: 'Basic Science', teacher: 'Dr. Musa', due: 'Lab notes uploaded', materials: 10 },
  { name: 'Civic Education', teacher: 'Ms. Bello', due: 'Group project live', materials: 6 },
  { name: 'Agric Science', teacher: 'Mr. Ibrahim', due: 'Farm log required', materials: 7 },
  { name: 'ICT', teacher: 'Ms. Charles', due: 'CBT practice open', materials: 9 },
];

const quickActions = [
  { label: 'Start Assignment', meta: '3 pending' },
  { label: 'Open CBT', meta: '2 available' },
  { label: 'Practice Corner', meta: 'AI session ready' },
  { label: 'View Results', meta: 'Pending approval' },
  { label: 'Library', meta: '4 books' },
  { label: 'Civic Centre', meta: 'Voting live' },
];

const DashboardStudent: React.FC = () => {
  return (
    <div className="student-shell" style={{background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)'}}>
      <aside className="student-sidebar" style={{background: '#fff', boxShadow: '0 4px 24px rgba(34, 197, 94, 0.08)', borderRadius: '1.2rem', padding: '1.5rem'}}>
        <div className="student-profile-card" style={{background: 'linear-gradient(135deg, #a7f3d0 0%, #38bdf8 100%)', color: '#0f172a', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem'}}>
          <div className="student-avatar" style={{width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #fda4af, #c4b5fd)', marginRight: 16}} />
          <div>
            <div className="student-name" style={{fontWeight: 700, fontSize: '1.1rem'}}>Amina Yusuf</div>
            <div className="student-meta" style={{fontSize: '0.9rem', color: '#475569'}}>JSS 2 • Green House</div>
          </div>
        </div>
        <div className="student-balance" style={{background: '#bbf7d0', color: '#166534', borderRadius: '1rem', padding: '0.7rem 1rem', marginBottom: '1.5rem', fontWeight: 600}}>
          Lams Balance: <span style={{fontWeight: 700}}>2,450</span>
        </div>
        <nav className="student-nav" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
          {sidebarItems.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={`student-nav-link ${index === 0 ? 'active' : ''}`}
              style={{background: index === 0 ? '#22c55e' : '#f1f5f9', color: index === 0 ? '#fff' : '#0f172a', border: 'none', borderRadius: '0.7rem', padding: '0.7rem 1.2rem', fontWeight: 600, fontSize: '1rem', boxShadow: index === 0 ? '0 2px 8px #22c55e33' : 'none'}}
            >
              <span>{item.label}</span>
              {item.badge && <span className="student-badge" style={{background: '#e0e7ff', color: '#0f172a', borderRadius: '999px', padding: '0.2rem 0.7rem', fontSize: '0.8rem', marginLeft: 8}}>{item.badge}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <section className="student-main" style={{padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '2rem'}}>
        <div className="student-topbar" style={{background: '#fff', borderRadius: '1rem', boxShadow: '0 2px 8px #cbd5e1', padding: '1.2rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem'}}>
          <input type="text" placeholder="Search subjects, assignments, materials..." style={{flex: 1, fontSize: '1.1rem', padding: '0.8rem 1.2rem', borderRadius: '0.8rem', border: '1px solid #cbd5e1', background: '#f8fafc'}} />
          <button type="button" className="student-pill" style={{fontSize: '1rem', padding: '0.7rem 1.5rem', background: '#e0e7ff', color: '#0f172a', border: 'none', borderRadius: '999px'}}>Farming Mode</button>
          <button type="button" className="student-pill" style={{fontSize: '1rem', padding: '0.7rem 1.5rem', background: '#e0e7ff', color: '#0f172a', border: 'none', borderRadius: '999px'}}>Notifications</button>
          <div className="student-topbar-avatar" style={{width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #a7f3d0, #38bdf8)'}} />
        </div>

        <div className="student-content" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem'}}>
          <div className="student-hero-card" style={{background: '#fff', borderRadius: '1.2rem', boxShadow: '0 4px 24px #cbd5e1', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
            <p className="student-hero-label" style={{fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem'}}>Welcome back, Amina Yusuf</p>
            <h2 style={{fontWeight: 700, fontSize: '2rem', margin: 0}}>Ready to learn, explore, and grow today.</h2>
            <p className="student-hero-sub" style={{color: '#475569', marginTop: '0.7rem'}}>Your assignments, CBT practice, and civic duties are synced for offline access.</p>
            <div style={{marginTop: '1.5rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <p className="student-hero-card-label" style={{fontWeight: 600, color: '#0f172a'}}>Profile completion</p>
                <h3 style={{fontWeight: 700, fontSize: '2rem', color: '#22c55e'}}>82%</h3>
                <p className="student-hero-card-sub" style={{color: '#475569'}}>Complete your profile to keep your Lams secure.</p>
              </div>
              <button type="button" className="student-hero-action" style={{background: '#22c55e', color: '#fff', border: 'none', borderRadius: '999px', padding: '0.7rem 1.5rem', fontWeight: 600}}>Complete Profile</button>
            </div>
          </div>

          <div className="student-metrics" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem'}}>
            <div className="student-card student-tone-1" style={{background: '#e0e7ff', borderRadius: '1rem', boxShadow: '0 2px 8px #cbd5e1', padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <p className="student-card-label" style={{fontWeight: 600, color: '#0f172a'}}>Assignments</p>
              <h3 style={{fontWeight: 700, fontSize: '1.5rem', color: '#22c55e'}}>3 pending</h3>
              <span className="student-card-meta" style={{color: '#475569'}}>2 due this week</span>
            </div>
            <div className="student-card student-tone-2" style={{background: '#bbf7d0', borderRadius: '1rem', boxShadow: '0 2px 8px #cbd5e1', padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <p className="student-card-label" style={{fontWeight: 600, color: '#0f172a'}}>CBT</p>
              <h3 style={{fontWeight: 700, fontSize: '1.5rem', color: '#22c55e'}}>2 available</h3>
              <span className="student-card-meta" style={{color: '#475569'}}>1 global CBT locked (120 Lams)</span>
            </div>
            <div className="student-card student-tone-3" style={{background: '#fda4af', borderRadius: '1rem', boxShadow: '0 2px 8px #cbd5e1', padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <p className="student-card-label" style={{fontWeight: 600, color: '#0f172a'}}>Results</p>
              <h3 style={{fontWeight: 700, fontSize: '1.5rem', color: '#22c55e'}}>Pending approval</h3>
              <span className="student-card-meta" style={{color: '#475569'}}>You will be notified when released</span>
            </div>
            <div className="student-card student-tone-4" style={{background: '#c4b5fd', borderRadius: '1rem', boxShadow: '0 2px 8px #cbd5e1', padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <p className="student-card-label" style={{fontWeight: 600, color: '#0f172a'}}>Practice Corner</p>
              <h3 style={{fontWeight: 700, fontSize: '1.5rem', color: '#22c55e'}}>AI session ready</h3>
              <span className="student-card-meta" style={{color: '#475569'}}>Next tip: Algebra mastery track</span>
            </div>
          </div>

          <div className="student-section" style={{background: '#fff', borderRadius: '1.2rem', boxShadow: '0 4px 24px #cbd5e1', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem'}}>
            <div className="student-section-header">
              <div>
                <h3 style={{fontWeight: 700, fontSize: '1.2rem', color: '#0f172a'}}>Quick Actions</h3>
                <p style={{color: '#475569'}}>Jump into tasks without opening the full modules. Start working straight from your dashboard.</p>
              </div>
            </div>
            <div className="student-quick-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem'}}>
              {quickActions.map((action) => (
                <button key={action.label} type="button" className="student-quick-card" style={{background: '#e0e7ff', borderRadius: '1rem', boxShadow: '0 2px 8px #cbd5e1', padding: '1rem', fontWeight: 600, color: '#0f172a', border: 'none', fontSize: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem'}}>
                  <span className="student-quick-title">{action.label}</span>
                  <span className="student-quick-meta" style={{color: '#475569'}}>{action.meta}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardStudent;
