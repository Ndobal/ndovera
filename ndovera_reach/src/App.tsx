import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CircleHelp, Contact, FileUp, Filter, LayoutDashboard, Mail, Megaphone, MessageCircle, MoreHorizontal, Plus, Search, Send, Settings, ShieldCheck, Users, X } from "lucide-react";

type ContactRow = { id: number; name: string; organisation: string; phone: string; email: string; source: string; tags: string[]; waOptIn: boolean; emailOptIn: boolean };
const initialContacts: ContactRow[] = [
  { id: 1, name: "Genesis International School", organisation: "School", phone: "+234 803 000 0000", email: "hello@example.com", source: "Manual", tags: ["School", "Abuja"], waOptIn: false, emailOptIn: false },
  { id: 2, name: "Greenfield Academy", organisation: "School", phone: "+234 806 000 0000", email: "office@example.com", source: "CSV import", tags: ["School", "Prospect"], waOptIn: true, emailOptIn: true },
  { id: 3, name: "Bright Future College", organisation: "School", phone: "+234 809 000 0000", email: "admin@example.com", source: "Website form", tags: ["School", "FCT"], waOptIn: true, emailOptIn: false },
];
const menu = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Contacts", icon: Contact },
  { label: "Audiences", icon: Users }, { label: "Campaigns", icon: Megaphone },
  { label: "Templates", icon: BookOpen }, { label: "Activity", icon: Activity }, { label: "Settings", icon: Settings },
];

export default function App() {
  const [section, setSection] = useState("Overview");
  const [contacts, setContacts] = useState(initialContacts);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("Demo workspace · provider sending is disabled");
  const [channel, setChannel] = useState<"WhatsApp" | "Email">("WhatsApp");
  const filtered = useMemo(() => contacts.filter(c => [c.name,c.organisation,c.phone,c.email,...c.tags].join(" ").toLowerCase().includes(query.toLowerCase())), [contacts, query]);
  const optedIn = contacts.filter(c => channel === "WhatsApp" ? c.waOptIn : c.emailOptIn).length;
  function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || (!phone.trim() && !email.trim())) return;
    setContacts(prev => [{ id: Date.now(), name: name.trim(), organisation: "Unclassified", phone: phone.trim(), email: email.trim(), source: "Manual", tags: ["New"], waOptIn: false, emailOptIn: false }, ...prev]);
    setName(""); setPhone(""); setEmail(""); setShowAdd(false); setSection("Contacts");
    setNotice("Contact saved. Marketing consent is not assumed.");
  }
  function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result || "").split(/\r?\n/).filter(Boolean);
      const rows = lines.slice(1).map((line, i) => {
        const cells = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        return { id: Date.now()+i, name: cells[0] || "Unnamed contact", organisation: cells[3] || "Unclassified", phone: cells[1] || "", email: cells[2] || "", source: "CSV import", tags: ["Imported"], waOptIn: false, emailOptIn: false };
      }).filter(r => r.phone || r.email);
      setContacts(prev => [...rows, ...prev]); setNotice(`Imported ${rows.length} contacts. All imported consent states are unset.`);
    };
    reader.readAsText(file); e.target.value = "";
  }
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">N</div><div><b>ndovera</b><span>REACH</span></div></div>
      <div className="workspace"><span className="avatar">N</span><div><b>Ndovera workspace</b><small>Marketing operations</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      {menu.map(item => <button key={item.label} className={section===item.label?"nav-item active":"nav-item"} onClick={()=>setSection(item.label)}><item.icon size={18}/>{item.label}{item.label==="Contacts"&&<em>{contacts.length}</em>}</button>)}
      <div className="sidebar-bottom"><ShieldCheck size={17}/><span>Consent-first messaging</span></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> {section}</div><div className="top-actions"><span className="environment"><i/> Demo mode</span><button className="icon-btn" aria-label="Notifications"><Bell size={18}/></button><span className="profile">NW</span></div></header>
      <div className="content">
        <div className="notice"><ShieldCheck size={16}/>{notice}<button onClick={()=>setNotice("Demo workspace · provider sending is disabled")}><X size={14}/></button></div>
        {section==="Overview" && <><div className="page-heading"><div><p className="eyebrow">YOUR OUTREACH, ORGANISED</p><h1>Good afternoon.</h1><p className="muted">Manage your contacts and permission-based campaigns in one place.</p></div><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={17}/> Add contact</button></div>
          <div className="stats"><Stat icon={<Users/>} label="Total contacts" value={contacts.length.toLocaleString()} delta="Across all audiences"/><Stat icon={<MessageCircle/>} label="WhatsApp opt-ins" value={contacts.filter(c=>c.waOptIn).length.toString()} delta="Permission recorded"/><Stat icon={<Mail/>} label="Email opt-ins" value={contacts.filter(c=>c.emailOptIn).length.toString()} delta="Permission recorded"/><Stat icon={<Megaphone/>} label="Campaigns sent" value="0" delta="No live provider connected"/></div>
          <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Recent contacts</h2><p>Latest additions to your database</p></div><button className="text-btn" onClick={()=>setSection("Contacts")}>View all <ArrowUpRight size={15}/></button></div><ContactTable rows={contacts.slice(0,4)}/></section>
          <section className="panel launch"><div className="launch-icon"><Send size={20}/></div><h2>Ready for your first campaign?</h2><p>Build an audience, prepare your message and review consent before sending.</p><button className="secondary" onClick={()=>setSection("Campaigns")}>Explore campaigns <ArrowUpRight size={15}/></button><div className="launch-foot"><ShieldCheck size={15}/> Sending stays disabled until providers are configured.</div></section></div>
        </>}
        {section==="Contacts" && <><div className="page-heading"><div><p className="eyebrow">YOUR DATABASE</p><h1>Contacts</h1><p className="muted">Collect, organise and manage your outreach contacts.</p></div><div className="actions"><label className="secondary upload"><FileUp size={16}/> Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv}/></label><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={17}/> Add contact</button></div></div><section className="panel"><div className="table-toolbar"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search names, schools, phone or email"/></div><button className="secondary"><Filter size={16}/> Filters</button><button className="secondary" onClick={()=>setNotice("Export is planned for the API-backed release.")}>Export</button></div><ContactTable rows={filtered}/></section></>}
        {section==="Audiences" && <Placeholder title="Audiences" sub="Group contacts by school, location, source and consent status." icon={<Users/>} action="Create audience" onAction={()=>setNotice("Audience builder will be connected to the database API in the next build step.")}/>}
        {section==="Campaigns" && <div><div className="page-heading"><div><p className="eyebrow">MESSAGING</p><h1>Campaigns</h1><p className="muted">Plan WhatsApp and email campaigns for opted-in audiences.</p></div><button className="primary" onClick={()=>setNotice("Campaign creation is available in the next implementation step. Live sending is disabled.")}><Plus size={17}/> New campaign</button></div><div className="channel-grid"><div className="panel channel"><MessageCircle/><h2>WhatsApp campaigns</h2><p>Official WhatsApp Business Cloud API. Approved templates and opt-in contacts only.</p><button className="secondary" onClick={()=>setChannel("WhatsApp")}>Selected channel {channel==="WhatsApp"&&<Check size={15}/>}</button></div><div className="panel channel"><Mail/><h2>Email campaigns</h2><p>Marketing email with unsubscribe handling, delivery events and suppression controls.</p><button className="secondary" onClick={()=>setChannel("Email")}>Selected channel {channel==="Email"&&<Check size={15}/>}</button></div></div><div className="panel compliance"><ShieldCheck/><div><b>{optedIn} contacts eligible on {channel}</b><p>Only contacts with recorded {channel} marketing consent can be selected for a campaign.</p></div></div></div>}
        {section==="Templates" && <Placeholder title="Message templates" sub="Manage approved WhatsApp templates and reusable email layouts." icon={<BookOpen/>} action="Add template" onAction={()=>setNotice("Template management will connect after provider setup.")}/>}
        {section==="Activity" && <Placeholder title="Activity" sub="Campaign events, delivery status, opt-outs and administrator audit logs." icon={<Activity/>} action="Refresh activity" onAction={()=>setNotice("No provider events yet. This workspace is in demo mode.")}/>}
        {section==="Settings" && <div><div className="page-heading"><div><p className="eyebrow">WORKSPACE CONTROL</p><h1>Settings</h1><p className="muted">Connect providers and configure sending safeguards.</p></div></div><div className="settings-list"><Setting title="WhatsApp Business Cloud API" text="Phone number ID, business account and server-side access token." status="Not connected"/><Setting title="Email provider" text="Connect an email service and verify your sending domain." status="Not connected"/><Setting title="Cloudflare services" text="D1 database, Queues and R2 storage for production." status="Not provisioned"/><Setting title="Team access" text="Owner, administrator, campaign operator and analyst roles." status="Planned"/></div></div>}
      </div>
    </main>
    {showAdd&&<div className="modal-backdrop" onClick={()=>setShowAdd(false)}><form className="modal" onSubmit={addContact} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">CONTACT DATABASE</p><h2>Add a contact</h2></div><button type="button" className="icon-btn" onClick={()=>setShowAdd(false)}><X/></button></div><label>Contact or organisation name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Greenfield Academy"/></label><label>Phone number<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+234..."/></label><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label><div className="consent-note"><ShieldCheck size={17}/> New contacts are saved without marketing consent. Record permission separately before adding them to campaigns.</div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary" type="submit">Save contact</button></div></form></div>}
  </div>;
}
function Stat({icon,label,value,delta}:{icon:React.ReactNode;label:string;value:string;delta:string}){return <div className="stat"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{delta}</small></div>}
function ContactTable({rows}:{rows:ContactRow[]}){return <div className="table-wrap"><table><thead><tr><th>CONTACT</th><th>PHONE / EMAIL</th><th>WHATSAPP</th><th>EMAIL</th><th>SOURCE</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td><b>{c.name}</b><small>{c.organisation} · {c.tags.join(", ")}</small></td><td>{c.phone||"—"}<small>{c.email||"—"}</small></td><td><span className={c.waOptIn?"pill good":"pill muted-pill"}>{c.waOptIn?"Opted in":"No consent"}</span></td><td><span className={c.emailOptIn?"pill good":"pill muted-pill"}>{c.emailOptIn?"Opted in":"No consent"}</span></td><td>{c.source}</td></tr>)}</tbody></table>{rows.length===0&&<div className="empty">No matching contacts found.</div>}</div>}
function Placeholder({title,sub,icon,action,onAction}:{title:string;sub:string;icon:React.ReactNode;action:string;onAction:()=>void}){return <div className="placeholder panel"><div className="placeholder-icon">{icon}</div><h1>{title}</h1><p>{sub}</p><button className="primary" onClick={onAction}><Plus size={16}/>{action}</button><small>This area is part of the staged Reach build.</small></div>}
function Setting({title,text,status}:{title:string;text:string;status:string}){return <div className="setting panel"><div><b>{title}</b><p>{text}</p></div><span className="pill muted-pill">{status}</span></div>}
