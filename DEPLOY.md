# Deployment Guide — Yeshiva Ateret Yaakov Website

## Option 1: Self-Hosted VPS (Recommended — images persist forever)

Best for: DigitalOcean, Linode, Hetzner, AWS EC2, or any Linux server you control.

### Step 1 — Set up server (one time)
```bash
# On your server (Ubuntu/Debian)
sudo apt update && sudo apt install -y nodejs npm git nginx

# Install PM2 to keep the site running
npm install -g pm2
```

### Step 2 — Deploy the site
```bash
# Clone or copy your project to the server
git clone <your-repo> /var/www/ateretyaakov
cd /var/www/ateretyaakov

# Install dependencies & build
npm install
npm run build

# Start with PM2 (keeps running after server restart)
pm2 start npm --name "ateret-yaakov" -- start
pm2 save
pm2 startup
```

### Step 3 — Point your domain
Add an Nginx config at `/etc/nginx/sites-available/ateretyaakov`:
```nginx
server {
    listen 80;
    server_name ateretyaakov.com www.ateretyaakov.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Then: `sudo ln -s /etc/nginx/sites-available/ateretyaakov /etc/nginx/sites-enabled/`
And: `sudo nginx -t && sudo systemctl reload nginx`

### ✅ Images on a VPS persist forever
Images uploaded via `/admin` are saved to `/var/www/ateretyaakov/public/images/`
on the server disk. They survive restarts, updates, and new deployments.

---

## Option 2: Vercel (Easy but images don't persist after deploy)

```bash
npm install -g vercel
vercel login
vercel --prod
```

⚠️ **Image limitation on Vercel:** Uploaded images are saved to the serverless
function's temporary filesystem and are wiped on each new deployment.

**Workaround for Vercel:** Upload all images locally via `/admin` on localhost,
then commit the `public/images/` folder to git before deploying:
```bash
git add public/images/
git commit -m "Add yeshiva images"
git push
vercel --prod
```

---

## Updating the live site

### For VPS (with git):
```bash
# On your server
cd /var/www/ateretyaakov
git pull
npm install
npm run build
pm2 restart ateret-yaakov
```

### For Vercel:
```bash
# Locally — add any new images first
git add public/images/
git commit -m "Update images"
git push
vercel --prod
```

---

## Admin page on live site

The `/admin` image manager works on any self-hosted server.
To protect it on production, the password is already set to `danilevy9`.

To change the password, edit line ~9 in `app/admin/page.tsx`:
```tsx
if (input === 'danilevy9') {   // ← change this
```

---

## Recommended: DigitalOcean Droplet

- Cost: ~$6/month (1GB RAM is plenty)
- Setup time: ~30 minutes
- Images: persist forever on disk
- Domain: point your DNS A record to the droplet IP
