const fs = require('fs');
let code = fs.readFileSync('c:/Users/HP/Desktop/Projects/ndovera/packages/server/server.ts', 'utf8');

const patch = `
// AI Token/Auras Consumption Backend
app.post('/api/auras/consume', requireAuth, (req, res) => {
  const { amount, reason } = req.body;
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    db.prepare('ALTER TABLE users ADD COLUMN auras_balance INTEGER DEFAULT 1000').run();
  } catch(e) {} // Ignore

  db.transaction(() => {
    const userRow = db.prepare('SELECT auras_balance FROM users WHERE id = ?').get(req.user.id);
    const balance = userRow?.auras_balance ?? 1000; // default gracefully
    if (balance < amount) {
      throw new Error('Insufficient Auras. Please recharge.');
    }
    
    db.prepare('UPDATE users SET auras_balance = auras_balance - ? WHERE id = ?').run(amount, req.user.id);
    
    // Log the transaction
    try {
      db.prepare('CREATE TABLE IF NOT EXISTS aura_transactions (id TEXT PRIMARY KEY, user_id TEXT, amount INTEGER, reason TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run();
      db.prepare('INSERT INTO aura_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)').run(
        'txn_' + Date.now() + Math.random(), req.user.id, -amount, reason
      );
    } catch(e) {}
  })();
  
  const newRow = db.prepare('SELECT auras_balance FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, balance: newRow.auras_balance });
});
`;

if (!code.includes('/api/auras/consume')) {
  code = code.replace('// --- Webhooks & Integration ---', patch + '\n// --- Webhooks & Integration ---');
  fs.writeFileSync('c:/Users/HP/Desktop/Projects/ndovera/packages/server/server.ts', code);
}
console.log('done aura patch.');