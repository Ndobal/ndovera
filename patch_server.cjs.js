const fs = require('fs');

let c = fs.readFileSync('packages/server/server.ts', 'utf8');

const routeStr = `  app.post('/api/shared-files', requireRoles(...SHARED_FILE_MANAGER_ROLES), (req, res) => {`;

const newRoute = `
  // Mock Virus Scanner & Image Reducer
  async function mockVirusScan(buffer: Buffer): Promise<boolean> {
    // In production, send to ClamAV or similar service.
    // For now, always clean unless it contains a dummy signature.
    if (buffer.toString('utf8').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      return false; 
    }
    return true;
  }

  async function mockImageServiceProcess(buffer: Buffer, mimetype: string): Promise<Buffer> {
    // In production, pass to an Image Processing service (like sharp) to reduce size.
    // We return original buffer for this mock.
    return buffer;
  }

  app.post('/api/shared-files/upload', upload.single('file'), requireRoles(...SHARED_FILE_MANAGER_ROLES), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      // Only allow Docs, PDF, Images
      const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Only DOC, PDF, and Images are allowed.' });
      }

      // Virus Scan
      const isClean = await mockVirusScan(file.buffer);
      if (!isClean) {
        return res.status(400).json({ error: 'Security Alert: Malware detected in file.' });
      }

      // If image, pass through image service to reduce size
      let processedBuffer = file.buffer;
      if (file.mimetype.startsWith('image/')) {
        processedBuffer = await mockImageServiceProcess(file.buffer, file.mimetype);
      }

      // Save to cloud (mocked to local uploads dir for now)
      const uploadBase = path.join(uploadsDir, String(schoolId), 'shared');
      if (!fs.existsSync(uploadBase)) {
        fs.mkdirSync(uploadBase, { recursive: true });
      }
      
      const ext = path.extname(file.originalname) || '';
      const filename = \`shared_file_\${Date.now()}\${ext}\`;
      const filePath = path.join(uploadBase, filename);
      fs.writeFileSync(filePath, processedBuffer);

      // We'll serve it as /uploads/:schoolId/shared/:filename
      const resourceUrl = \`http://localhost:5174/uploads/\${schoolId}/shared/\${filename}\`;

      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : file.originalname;
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const requestedScope = typeof req.body?.scope === 'string' ? req.body.scope.trim().toLowerCase() : 'school';
      const fileType = file.mimetype.startsWith('image/') ? 'Image/Media' : 'Document';
      
      const sourceType = requestedScope === 'ndovera' ? 'ndovera' : 'tenant';
      const scope = ['school', 'ndovera'].includes(requestedScope) ? requestedScope : 'school';

      if (scope === 'ndovera' && !['Owner', 'Super Admin', 'Ami'].includes(actor.role)) {
        return res.status(403).json({ error: 'Only Ndovera/global roles can publish Ndovera-origin files.' });
      }

      const id = makeId('shared_file');
      db.prepare('INSERT INTO shared_files (id, school_id, title, description, resource_url, scope, source_type, file_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, scope === 'ndovera' ? null : schoolId, title, description || null, resourceUrl, scope, sourceType, fileType, actor.id);

      return res.status(201).json({ ok: true, id, resourceUrl });
    } catch (err) {
      console.error('shared files upload error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/shared-files', requireRoles(...SHARED_FILE_MANAGER_ROLES), (req, res) => {`;

c = c.replace(routeStr, newRoute);

fs.writeFileSync('packages/server/server.ts', c);
console.log('Added /api/shared-files/upload route with virus scan and image red.');
