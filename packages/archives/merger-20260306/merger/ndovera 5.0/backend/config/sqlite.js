const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../local_databases');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

const usersDB = new sqlite3.Database(path.join(dbPath, 'users.sqlite'));
const schoolsDB = new sqlite3.Database(path.join(dbPath, 'schools.sqlite'));
const hosDB = new sqlite3.Database(path.join(dbPath, 'hos.sqlite'));
const lamsDB = new sqlite3.Database(path.join(dbPath, 'lams.sqlite'));
const websiteDB = new sqlite3.Database(path.join(dbPath, 'website.sqlite'));
const syncDB = new sqlite3.Database(path.join(dbPath, 'sync.sqlite'));
const blogDB = new sqlite3.Database(path.join(dbPath, 'blog.sqlite'));
const dropboxDB = new sqlite3.Database(path.join(dbPath, 'dropbox.sqlite'));
const questionBankDB = new sqlite3.Database(path.join(dbPath, 'question_bank.sqlite'));
const resultsBulkDB = new sqlite3.Database(path.join(dbPath, 'results_bulk.sqlite'));
const messagingDB = new sqlite3.Database(path.join(dbPath, 'messaging.sqlite'));
const liveEventsDB = new sqlite3.Database(path.join(dbPath, 'live_events.sqlite'));
const videoGalleryDB = new sqlite3.Database(path.join(dbPath, 'video_gallery.sqlite'));
const nmeDB = new sqlite3.Database(path.join(dbPath, 'nme.sqlite'));
const identityDB = new sqlite3.Database(path.join(dbPath, 'identity.sqlite'));
const eventBusDB = new sqlite3.Database(path.join(dbPath, 'event_bus.sqlite'));
const onlineExamDB = new sqlite3.Database(path.join(dbPath, 'online_exam.sqlite'));
const settingsDB = new sqlite3.Database(path.join(dbPath, 'settings.sqlite'));
const onboardingDB = new sqlite3.Database(path.join(dbPath, 'onboarding.sqlite'));

module.exports = {
  usersDB,
  schoolsDB,
  hosDB,
  lamsDB,
  websiteDB,
  syncDB,
  blogDB,
  dropboxDB,
  questionBankDB,
  resultsBulkDB,
  messagingDB,
  liveEventsDB,
  videoGalleryDB,
  nmeDB,
  identityDB,
  eventBusDB,
  onlineExamDB,
  settingsDB,
  onboardingDB,
};
