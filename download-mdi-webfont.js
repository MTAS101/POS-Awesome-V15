const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');

// Configuration
const config = {
  version: '7.4.47', // Match the version in package.json
  cssUrl: 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css',
  fontUrls: [
    'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/fonts/materialdesignicons-webfont.eot',
    'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/fonts/materialdesignicons-webfont.woff2',
    'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/fonts/materialdesignicons-webfont.woff',
    'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/fonts/materialdesignicons-webfont.ttf'
  ],
  cssOutputPath: './posawesome/public/css/materialdesignicons.min.css',
  fontsOutputDir: './posawesome/public/css/fonts/'
};

// Create directories if they don't exist
if (!fs.existsSync(path.dirname(config.cssOutputPath))) {
  fs.mkdirSync(path.dirname(config.cssOutputPath), { recursive: true });
  console.log(`✓ Created directory: ${path.dirname(config.cssOutputPath)}`);
}

if (!fs.existsSync(config.fontsOutputDir)) {
  fs.mkdirSync(config.fontsOutputDir, { recursive: true });
  console.log(`✓ Created directory: ${config.fontsOutputDir}`);
}

// Download a file from URL
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    
    const file = createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded ${path.basename(outputPath)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

// Download and process CSS file
async function downloadAndProcessCSS() {
  try {
    // Download CSS file
    await downloadFile(config.cssUrl, config.cssOutputPath);
    
    // Read the CSS file
    let cssContent = fs.readFileSync(config.cssOutputPath, 'utf8');
    
    // Update font paths in CSS to point to our local fonts
    cssContent = cssContent.replace(/src:\s*url\(['"]?[^)'"]*fonts\/materialdesignicons-webfont/g, 
      `src: url('/assets/posawesome/css/fonts/materialdesignicons-webfont`);
    
    // Write the updated CSS back to the file
    fs.writeFileSync(config.cssOutputPath, cssContent);
    console.log(`✓ Updated font paths in CSS file`);
    
    // Download font files
    for (const fontUrl of config.fontUrls) {
      const fontFilename = path.basename(fontUrl);
      const outputPath = path.join(config.fontsOutputDir, fontFilename);
      await downloadFile(fontUrl, outputPath);
    }
    
    console.log('\n✓ MDI Webfont download complete!');
  } catch (error) {
    console.error('Error downloading webfont:', error);
  }
}

// Run the download process
downloadAndProcessCSS();