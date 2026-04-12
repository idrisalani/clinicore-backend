import fs from 'fs';

// Check git log to see if ConsultationForm was in the last commit
import { execSync } from 'child_process';
try {
  const log = execSync('git log --oneline -5', { cwd: '../frontend-web', encoding: 'utf8' });
  console.log('Last 5 commits:\n', log);
  
  const diff = execSync('git show --name-only HEAD', { cwd: '../frontend-web', encoding: 'utf8' });
  console.log('Files in last commit:\n', diff.split('\n').slice(0, 20).join('\n'));
} catch(e) {
  console.log('Git error:', e.message);
}
