const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'packages/server/server.ts');
let code = fs.readFileSync(serverPath, 'utf8');

const injection = `
// ==================== DAILY DUTY REPORTS ====================
app.post('/api/duty-report', requireAuth, (req, res) => {
  const { report_text } = req.body;
  const user = req.user;
  const today = new Date().toISOString().split('T')[0];
  const id = crypto.randomUUID();
  try {
    db.prepare("INSERT INTO duty_reports (id, staff_id, date, report_text) VALUES (?, ?, ?, ?)").run(id, user.id, today, report_text);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/duty-report', requireAuth, (req, res) => {
  try {
    const isHoS = req.user.role === 'hos' || req.user.role === 'owner';
    let query = "SELECT d.*, u.name as staff_name FROM duty_reports d LEFT JOIN users u ON d.staff_id = u.id ORDER BY d.created_at DESC";
    let reports = db.prepare(query).all();
    
    if (!isHoS) {
      reports = reports.filter(r => r.staff_id === req.user.id);
    }
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

`;

if (!code.includes('/api/duty-report')) {
  code = code.replace("app.listen(", injection + "\napp.listen(");
  fs.writeFileSync(serverPath, code);
  console.log("Duty endpoints injected");
} else {
  console.log("Duty endpoints already exist");
}
