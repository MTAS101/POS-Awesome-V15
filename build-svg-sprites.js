const fs = require('fs');
const path = require('path');
const SVGSpriter = require('svg-sprite');
const glob = require('glob');

// Configuration
const config = {
  dest: './posawesome/public/dist',
  shape: {
    id: {
      generator: 'mdi-%s'
    },
    transform: ['svgo'],
  },
  mode: {
    symbol: {
      dest: '.',
      sprite: 'mdi-sprite.svg'
    }
  }
};

// Create spriter instance
const spriter = new SVGSpriter(config);

// Get the list of icons from the audit file
const iconList = fs.readFileSync('./icon-audit/unique-mdi-icons.txt', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(icon => icon.replace('mdi-', ''));

console.log(`Total icons to process: ${iconList.length}`);

// Track missing icons
const missingIcons = [];

// Add each SVG file to the spriter
iconList.forEach(iconName => {
  const svgPath = path.join('./node_modules/@mdi/svg/svg', `${iconName}.svg`);
  try {
    if (fs.existsSync(svgPath)) {
      const svgContent = fs.readFileSync(svgPath, 'utf8');
      try {
        // Fix: Use null as the second parameter to let the library determine the name
        spriter.add(svgPath, null, svgContent);
        console.log(`✓ Added ${iconName}.svg`);
      } catch (spriterError) {
        console.error(`✗ Error adding ${iconName}.svg to sprite:`, spriterError.message);
        missingIcons.push({ name: iconName, error: 'Sprite addition error', message: spriterError.message });
      }
    } else {
      console.warn(`✗ Warning: ${iconName}.svg not found in node_modules/@mdi/svg/svg`);
      missingIcons.push({ name: iconName, error: 'File not found' });
    }
  } catch (fsError) {
    console.error(`✗ Error processing ${iconName}.svg:`, fsError.message);
    missingIcons.push({ name: iconName, error: 'File system error', message: fsError.message });
  }
});

// Log summary of missing icons
if (missingIcons.length > 0) {
  console.log('\n==== MISSING ICONS SUMMARY ====');
  console.log(`Total missing icons: ${missingIcons.length}`);
  console.log('Missing icon details:');
  missingIcons.forEach(icon => {
    console.log(`- ${icon.name}: ${icon.error}${icon.message ? ` (${icon.message})` : ''}`);
  });
  
  // Write missing icons to a file for reference
  const missingIconsReport = missingIcons.map(icon => 
    `${icon.name}: ${icon.error}${icon.message ? ` (${icon.message})` : ''}`
  ).join('\n');
  
  fs.writeFileSync('./icon-audit/missing-icons-report.txt', missingIconsReport);
  console.log('Missing icons report saved to ./icon-audit/missing-icons-report.txt');
}

// Compile the sprite
spriter.compile((error, result) => {
  if (error) {
    console.error('Error creating sprite:', error);
    return;
  }
  
  // Save the sprite
  for (const mode in result) {
    for (const resource in result[mode]) {
      const outputPath = path.join(config.dest, result[mode][resource].path);
      const outputDir = path.dirname(outputPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write the file
      fs.writeFileSync(outputPath, result[mode][resource].contents);
      console.log(`\n✓ Sprite saved to ${outputPath}`);
      console.log(`Successfully processed ${iconList.length - missingIcons.length} of ${iconList.length} icons`);
    }
  }
});