# PWA Implementation Guide for POS Awesome

This guide explains how to fix the common service worker scope issues when implementing PWA functionality in POS Awesome.

## The Problem

The main error:
```
Service Worker registration failed: SecurityError: Failed to register a ServiceWorker for scope ('/app/') with script ('/assets/posawesome/js/service-worker.js'): The path of the provided scope ('/app/') is not under the max scope allowed ('/assets/posawesome/js/').
```

This happens because browsers only allow a service worker to control pages within its directory or subdirectories. Our service worker is at `/assets/posawesome/js/` but we need it to control `/app/`.

## Solution Options

### Option 1: Root Service Worker (Recommended)

Copy the service worker to the site root directory. This is automatically handled by our setup script.

1. The setup script will copy `service-worker.js` to the site's assets directory
2. The PWA registration code will use `/service-worker.js` instead of `/assets/posawesome/js/service-worker.js`
3. This allows the service worker to control the `/app/` scope

To apply this solution:

```bash
# Build the app
bench build --app posawesome

# Run the setup script manually if needed
bench execute posawesome.setup.setup_service_worker.setup_service_worker

# Restart the bench
bench restart
```

### Option 2: Nginx Configuration

If Option 1 doesn't work, you can add the necessary header via Nginx:

Add this to your Nginx server configuration (usually in `/etc/nginx/conf.d/` or `/etc/nginx/sites-available/`):

```nginx
location /assets/posawesome/js/service-worker.js {
    add_header Service-Worker-Allowed /app/;
}
```

Then restart Nginx:

```bash
sudo service nginx restart
```

### Option 3: Site Config

Add the header to your site-config.json:

```json
{
  "http_headers": [
    ["Service-Worker-Allowed", "/app/"]
  ]
}
```

Then restart your bench:

```bash
bench restart
```

## Manual Fix for Emergencies

If you need to quickly fix the issue, you can directly copy the service worker to the site's root assets directory:

```bash
# Go to the frappe bench directory
cd /path/to/frappe-bench

# Copy the service worker file
cp apps/posawesome/posawesome/public/js/service-worker.js sites/assets/service-worker.js

# Make sure permissions are correct
sudo chown -R frappe:frappe sites/assets/service-worker.js

# Restart
bench restart
```

## Verification

After implementing the fix:

1. Open your browser developer tools (F12)
2. Go to the Application tab
3. Select Service Workers in the sidebar
4. Verify that the service worker is registered with the correct scope (`/app/`)
5. Check for any errors in the console

## Troubleshooting

If you still face issues:

1. Clear your browser cache completely
2. Unregister any existing service workers
3. Make sure the service worker file is accessible at the expected URL
4. Check browser console for specific errors
5. Ensure your Nginx/web server isn't blocking the Service-Worker-Allowed header

## Support

For additional help, contact the POS Awesome team or open an issue on GitHub. 