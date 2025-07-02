import { execSync } from 'child_process';

console.log('Installing dependencies...');
execSync('yarn install', { stdio: 'inherit', cwd: 'frontend' });

console.log('Building the application...');
execSync('yarn build', { stdio: 'inherit', cwd: 'frontend' });
