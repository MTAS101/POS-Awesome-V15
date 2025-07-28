# PosAwesome Vite Migration

This document outlines the migration from esbuild to Vite for the PosAwesome POS application.

## Migration Summary

The build system has been successfully migrated from esbuild to Vite, providing:

**Note**: All package management and build commands use Yarn consistently.

- ✅ Faster development server with HMR (Hot Module Replacement)
- ✅ Better Vue 3 support with built-in Vue plugin
- ✅ Improved CSS handling and source maps
- ✅ Modern build tooling with better performance
- ✅ Development and production builds

## Changes Made

### 1. Package.json Updates
- Added `build` and `preview` scripts
- Removed esbuild dependency
- Kept existing Vite and Vue plugin dependencies

### 2. Vite Configuration (`vite.config.js`)
- Enhanced build configuration for library mode
- Added development server configuration
- Improved CSS handling with source maps
- Configured proper asset file naming

### 3. Build Script Updates
- Updated `build.js` to use Vite instead of esbuild
- Removed dependency on `esbuild.config.js`

### 4. Development Setup
- Created `index.html` for development server
- Added `dev-entry.js` for standalone development
- Mocked Frappe framework for development

## Usage

### Development
```bash
# Start development server
yarn dev
```

The development server will start on `http://localhost:3000`

### Production Build
```bash
# Build for production
yarn build
```

### Preview Production Build
```bash
# Preview production build locally
yarn preview
```

### Legacy Build Script
```bash
# Use the existing build script (now uses Vite)
node build.mjs
```

### Package Management
```bash
# Install dependencies
yarn install

# Add a new dependency
yarn add package-name

# Add a development dependency
yarn add -D package-name

# Remove a dependency
yarn remove package-name
```

## File Structure

```
├── vite.config.js          # Vite configuration
├── index.html              # Development entry point
├── build.mjs               # Build script (updated for Vite)
├── package.json            # Updated scripts and dependencies
├── posawesome/
│   └── public/
│       └── js/
│           └── posapp/
│               ├── posapp.js        # Original entry point
│               └── dev-entry.js     # Development entry point
└── posawesome/public/dist/js/       # Build output directory
```

## Benefits of Vite Migration

1. **Faster Development**: Vite provides instant server start and HMR
2. **Better Vue Support**: Native Vue 3 support with optimized plugin
3. **Modern Tooling**: Uses modern ES modules and native browser features
4. **Improved DX**: Better error messages and debugging experience
5. **Optimized Builds**: More efficient production builds with tree-shaking

## Migration Notes

- The original `posapp.js` remains unchanged for production use
- `dev-entry.js` provides a development-friendly entry point
- CSS is now properly handled with source maps
- Build output remains compatible with existing Frappe integration
- **ESM Migration**: Updated to use ES modules to avoid Vite CJS deprecation warnings

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the port in `vite.config.js`
2. **Module not found**: Ensure all dependencies are installed with `yarn install`
3. **Build errors**: Check the console for specific error messages

### Rollback

If you need to rollback to esbuild:
1. Restore the original `package.json`
2. Restore `esbuild.config.js`
3. Update `build.js` to use esbuild again
4. Remove `vite.config.js` and `index.html`

## Next Steps

Consider these potential improvements:
- Add TypeScript support
- Configure environment variables
- Add testing setup with Vitest
- Optimize bundle splitting for better performance 