const { usersDB } = require('./config/sqlite');
const bcrypt = require('bcrypt');

async function main() {
  const users = [
    {
      id: 'owner-demo-1',
      name: 'Owner Demo',
      email: 'owner@example.com',
      password: 'Password123!',
      roles: 'owner',
      school_id: 'school-demo-1',
      language_pref: 'en',
    },
    {
      id: 'hos-demo-1',
      name: 'HOS Demo',
      email: 'hos@example.com',
      password: 'Password123!',
      roles: 'hos',
      school_id: 'school-demo-1',
      language_pref: 'en',
    },
    {
      id: 'teacher-demo-1',
      name: 'Teacher Demo',
      email: 'teacher@example.com',
      password: 'Password123!',
      roles: 'teacher',
      school_id: 'school-demo-1',
      language_pref: 'en',
    },
    {
      id: 'staff-demo-1',
      name: 'Staff Demo',
      email: 'staff@example.com',
      password: 'Password123!',
      roles: 'staff',
      school_id: 'school-demo-1',
      language_pref: 'en',
    },
    {
      id: 'student-demo-1',
      name: 'Student Demo',
      email: 'student@example.com',
      password: 'Password123!',
      roles: 'student',
      school_id: 'school-demo-1',
      language_pref: 'en',
    },
    {
      id: 'parent-demo-1',
      name: 'Parent Demo',
      email: 'parent@example.com',
      password: 'Password123!',
      roles: 'parent',
      school_id: 'school-demo-1',
      language_pref: 'en',
    },
  ];

  const SALT_ROUNDS = 10;

  await new Promise((resolve, reject) => {
    usersDB.serialize(async () => {
      try {
        for (const u of users) {
          const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
          await new Promise((res, rej) => {
            usersDB.run(
              `INSERT OR REPLACE INTO users (id, name, email, password, roles, school_id, language_pref)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [u.id, u.name, u.email, hash, u.roles, u.school_id, u.language_pref],
              (err) => {
                if (err) return rej(err);
                res();
              },
            );
          });
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });

  console.log('Demo users seeded.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
