import { execSync } from 'child_process';

console.log('Installing dependencies...');
execSync('yarn install', { stdio: 'inherit' });

console.log('Building the application...');
execSync('vite build', { stdio: 'inherit' });

