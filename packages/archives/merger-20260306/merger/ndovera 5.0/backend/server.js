const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// Initialize SQLite databases and tables (side-effect modules)
require('./databases/users_db');
require('./databases/schools_db');
require('./databases/hos_db');
require('./databases/lams_db');
require('./databases/website_db');
require('./databases/sync_db');
require('./databases/blog_db');
require('./databases/dropbox_db');
require('./databases/question_bank_db');
require('./databases/results_bulk_db');
require('./databases/messaging_db');
require('./databases/live_events_db');
require('./databases/video_gallery_db');
require('./databases/nme_db');
require('./databases/identity_db');
require('./databases/event_bus_db');
require('./databases/online_exam_db');
require('./databases/settings_db');
require('./databases/onboarding_db');

const usersRoutes = require('./routes/users');
const schoolsRoutes = require('./routes/schools');
const hosRoutes = require('./routes/hos');
const lamsRoutes = require('./routes/lams');
const websiteRoutes = require('./routes/website');
const syncRoutes = require('./routes/sync');
const blogRoutes = require('./routes/blog');
const dropboxRoutes = require('./routes/dropbox');
const questionBankRoutes = require('./routes/questionBank');
const resultsBulkRoutes = require('./routes/resultsBulk');
const messagingRoutes = require('./routes/messaging');
const liveEventsRoutes = require('./routes/liveEvents');
const videoGalleryRoutes = require('./routes/videoGallery');
const nmeRoutes = require('./routes/nme');
const identityRoutes = require('./routes/identity');
const eventBusRoutes = require('./routes/eventBus');
const onlineExamRoutes = require('./routes/onlineExams');
const settingsRoutes = require('./routes/settings');
const onboardingRoutes = require('./routes/onboarding');

const app = express();

const corsOptions = {
  origin:
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_ORIGIN ||
    'http://localhost:5183',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.use('/api/users', usersRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/hos', hosRoutes);
app.use('/api/lams', lamsRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/dropbox', dropboxRoutes);
app.use('/api/question-bank', questionBankRoutes);
app.use('/api/results-bulk', resultsBulkRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/live-events', liveEventsRoutes);
app.use('/api/video-gallery', videoGalleryRoutes);
app.use('/api/nme', nmeRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/event-bus', eventBusRoutes);
app.use('/api/online-exams', onlineExamRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/onboarding', onboardingRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Ndovera backend is running',
    status: 'ok',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Ndovera backend running on port ${PORT}`);
});
