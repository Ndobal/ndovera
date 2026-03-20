const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'packages/server/server.ts');
let code = fs.readFileSync(serverPath, 'utf8');

// Find the existing scan endpoint
const scanStart = code.indexOf(`app.post('/api/attendance/scan'`);
if (scanStart !== -1 && !code.includes("FINE_AMOUNT = 2000")) {
  console.log("Rewriting attendance scan endpoint to support in/out toggling and fines.");
  
  const scanEnd = code.indexOf(`app.get('/api/qr/my-token'`, scanStart);
  
  // Create the new logic
  const newLogic = `
app.post('/api/attendance/scan', requireAuth, (req, res) => {
  const { qr_token, face_data, override_role } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toISOString();
  
  if (!qr_token) {
    return res.status(400).json({ error: 'No ID token provided' });
  }

  try {
    let person = db.prepare("SELECT * FROM users WHERE qr_token = ?").get(qr_token);
    if (!person) {
      person = db.prepare("SELECT * FROM students WHERE qr_token = ?").get(qr_token);
    }
    
    if (!person) {
      return res.status(404).json({ error: 'Unrecognized or invalid token.' });
    }

    const roleScanned = person.role || override_role || 'student';
    
    // Check if they signed in today
    const existingToday = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(person.id, today);
    
    // Check previous day record to see if they forgot to sign out
    const prevRecord = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date < ? AND status = 'Present' ORDER BY date DESC LIMIT 1").get(person.id, today);
    
    if (prevRecord && !prevRecord.sign_out_time) {
      // Forgot to sign out! Auto sign-out and apply fine
      db.prepare("UPDATE attendance SET sign_out_time = ? WHERE id = ?").run(nowTime, prevRecord.id);
      
      if (['staff', 'teacher', 'admin'].includes(person.role)) {
        const FINE_AMOUNT = 2000;
        const fineId = crypto.randomUUID();
        db.prepare("INSERT INTO attendance_fines (id, user_id, amount, reason, date) VALUES (?, ?, ?, ?, ?)").run(
          fineId, person.id, FINE_AMOUNT, "Failure to sign out", prevRecord.date
        );
      }
    }

    if (existingToday) {
      // Toggle sign out
      if (!existingToday.sign_out_time) {
        db.prepare("UPDATE attendance SET sign_out_time = ? WHERE id = ?").run(nowTime, existingToday.id);
        return res.json({ success: true, message: 'Signed Out', user: person });
      } else {
        return res.json({ success: true, message: 'Already signed out for today', user: person });
      }
    } else {
      // First scan of day = Sign In
      const attId = crypto.randomUUID();
      db.prepare("INSERT INTO attendance (id, user_id, date, status, role, sign_in_time) VALUES (?, ?, ?, ?, ?, ?)").run(
        attId, person.id, today, 'Present', roleScanned, nowTime
      );
      return res.json({ success: true, message: 'Signed In', user: person });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

  code = code.substring(0, scanStart) + newLogic + code.substring(scanEnd);
  fs.writeFileSync(serverPath, code);
  console.log("Patched scan logic to support offline queueing and fines.");
}
