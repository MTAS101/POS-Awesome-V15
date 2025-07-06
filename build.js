const { execSync } = require('child_process');

console.log('Installing dependencies...');
execSync('yarn install', { stdio: 'inherit' });

console.log('Building the application...');
execSync('vite build', { stdio: 'inherit' });

console.log('Copying bundle to public/js...');
execSync('cp posawesome/public/dist/js/posawesome.bundle.js posawesome/public/js/posawesome.bundle.js', { stdio: 'inherit' });

