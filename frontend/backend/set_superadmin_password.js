const { upsertSettings, getSettings } = require('./db');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setSuperadminPassword() {
  const currentSettings = await getSettings('ndobalamwilliams@ndovera.com');
  if (!currentSettings) {
    console.error('Superadmin settings not found');
    rl.close();
    return;
  }

  rl.question('Enter new password for superadmin: ', (newPassword) => {
    currentSettings.password = newPassword;
    upsertSettings('ndobalamwilliams@ndovera.com', currentSettings).then(() => {
      console.log('Superadmin password updated successfully');
      rl.close();
    }).catch((err) => {
      console.error('Error updating password:', err);
      rl.close();
    });
  });
}

setSuperadminPassword();