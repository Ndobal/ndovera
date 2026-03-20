const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'packages/server/server.ts');
let code = fs.readFileSync(serverPath, 'utf8');

// The new block
const endpoints = `
// ==================== AURAS & PREMIUM FEATURES ====================
app.get('/api/auras/balance', requireAuth, (req, res) => {
  const user = db.prepare("SELECT auras FROM users WHERE id = ?").get(req.user.id);
  res.json({ auras: user?.auras || 0 });
});

app.post('/api/auras/deduct', requireAuth, (req, res) => {
  const { amount, reason } = req.body;
  const user = db.prepare("SELECT auras FROM users WHERE id = ?").get(req.user.id);
  
  if (user.auras < amount) {
    return res.status(403).json({ error: 'Insufficient AURAS. Please top up.' });
  }

  db.prepare("UPDATE users SET auras = auras - ? WHERE id = ?").run(amount, req.user.id);
  res.json({ success: true, remaining: user.auras - amount });
});

app.post('/api/duty-report/ai-review', requireAuth, (req, res) => {
  // Simulates AI Review (costs 10 AURAS)
  const { report_data } = req.body;
  
  // Here we pretend to call OpenAI / Gemini
  const mockAnalysis = {
    summary: "Duty day was mostly normal with isolated incidents during break time.",
    risks: ["Repeated rowdiness observed during break", "Potential supervision gap at Gate B"],
    recommendations: ["Assign one additional Assistant to Break duty tomorrow", "Review Gate B protocols"]
  };
  
  res.json(mockAnalysis);
});

app.post('/api/duty-report/ai-autofill', requireAuth, (req, res) => {
  // Simulates AI Auto-fill (costs 5 AURAS)
  const { prompt } = req.body;
  res.json({
    text: \`AI Expanded: \${prompt}. The situation was handled professionally according to standard school protocols, ensuring the safety and discipline of all students involved.\`
  });
});

// ==================== DAILY DUTY REPORTS ====================
app.post('/api/duty-report', requireAuth, (req, res) => {
  const { report_data, ai_analysis } = req.body;
  const user = req.user;
  const today = new Date().toISOString().split('T')[0];
  const id = crypto.randomUUID();
  try {
    db.prepare("INSERT INTO duty_reports (id, staff_id, date, report_data, ai_analysis, report_text) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, user.id, today, JSON.stringify(report_data), JSON.stringify(ai_analysis || null), report_data.general_notes || ''
    );
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
    
    // Parse JSON
    reports = reports.map(r => ({
      ...r,
      report_data: r.report_data ? JSON.parse(r.report_data) : {},
      ai_analysis: r.ai_analysis ? JSON.parse(r.ai_analysis) : null
    }));

    if (!isHoS) {
      reports = reports.filter(r => r.staff_id === req.user.id);
    }
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

// Remove old duty report block
const startIdx = code.indexOf('// ==================== DAILY DUTY REPORTS ====================');
if (startIdx !== -1) {
  let endIdx = code.indexOf('app.listen(', startIdx);
  if (endIdx === -1) endIdx = code.length;
  code = code.substring(0, startIdx) + endpoints + "\n" + code.substring(endIdx);
  fs.writeFileSync(serverPath, code);
  console.log("V2 Endpoints injected");
}

