# Deployment Checklist

Use this checklist when deploying the project with:
- Frontend on Hostinger Premium
- Backend on Render
- Database on MongoDB Atlas

Assumption:
- The app will be hosted at the root domain, like `https://yourdomain.com`
- Not inside a subfolder like `https://yourdomain.com/app`

## Before You Start

- [ ] You have a Hostinger account and domain
- [ ] You have a Render account
- [ ] You have a MongoDB Atlas account
- [ ] This project is pushed to GitHub
- [ ] You know your final domain name

## 1. MongoDB Atlas

- [ ] Log in to MongoDB Atlas
- [ ] Create a cluster if you do not already have one
- [ ] Create a database user with a username and password
- [ ] Open `Network Access`
- [ ] Add an IP access rule
- [ ] For easiest first deployment, allow `0.0.0.0/0`
- [ ] Open `Database` -> `Connect`
- [ ] Choose `Drivers`
- [ ] Copy the MongoDB connection string
- [ ] Replace `<username>`, `<password>`, and database name in the connection string
- [ ] Save this final value somewhere safe as `MONGODB_URI`

## 2. Push Code to GitHub

- [ ] Make sure your latest local changes are saved
- [ ] Push the repo to GitHub
- [ ] Confirm these files exist in the repo:
  - [render.yaml](C:/Users/DELL/myloancrm/render.yaml)
  - [.env.example](C:/Users/DELL/myloancrm/.env.example)
  - [public/.htaccess](C:/Users/DELL/myloancrm/public/.htaccess)
  - [package.json](C:/Users/DELL/myloancrm/package.json)

## 3. Create Backend on Render

- [ ] Log in to Render
- [ ] Click `New`
- [ ] Click `Blueprint`
- [ ] Connect your GitHub account if needed
- [ ] Select this repository
- [ ] Start deployment

## 4. Add Render Environment Variables

- [ ] In Render, open your new web service
- [ ] Open `Environment`
- [ ] Add `MONGODB_URI`
- [ ] Paste your MongoDB Atlas connection string
- [ ] Add `JWT_SECRET`
- [ ] Set it to a long random secret
- [ ] Add `CORS_ORIGIN`
- [ ] Set it to:

```env
https://yourdomain.com,https://www.yourdomain.com
```

- [ ] Add `JWT_EXPIRE`
- [ ] Set it to:

```env
30d
```

- [ ] Save changes
- [ ] Redeploy if Render does not redeploy automatically

## 5. Confirm Backend Works

- [ ] Wait until Render deployment finishes successfully
- [ ] Copy the Render backend URL
- [ ] Open this in your browser:

```text
https://your-render-service.onrender.com/api/health
```

- [ ] Confirm the response shows success
- [ ] If it says database is disconnected, fix `MONGODB_URI` or Atlas network access first

## 6. Create Frontend Production Env

- [ ] In your project root, create a file named `.env.production`
- [ ] Add this line using your real Render backend URL:

```env
REACT_APP_API_BASE_URL=https://your-render-service.onrender.com
```

- [ ] Save the file

## 7. Build the Frontend

- [ ] Open terminal in the project root
- [ ] Run:

```bash
npm run build
```

- [ ] Wait for build success
- [ ] Confirm the `build` folder now exists
- [ ] Confirm `.htaccess` exists inside `build`

## 8. Upload Frontend to Hostinger

- [ ] Log in to Hostinger
- [ ] Open `Websites`
- [ ] Open your site dashboard
- [ ] Open `Files`
- [ ] Open `File Manager`
- [ ] Open the `public_html` folder
- [ ] If this domain is only for this app, delete Hostinger starter files like `default.php` or old `index.*`
- [ ] Upload everything inside the local `build` folder into `public_html`
- [ ] Do not upload the `build` folder itself
- [ ] Confirm these exist directly inside `public_html`:
  - `index.html`
  - `.htaccess`
  - `asset-manifest.json`
  - `static/`

## 9. First Live Check

- [ ] Open `https://yourdomain.com`
- [ ] Confirm the app loads
- [ ] Open `https://yourdomain.com/login`
- [ ] Confirm the login page loads
- [ ] Refresh the page while on `/login`
- [ ] Confirm it still works

If refreshing gives a 404:
- [ ] Check that `.htaccess` exists in `public_html`

## 10. Create the First Admin User

- [ ] On the live login page, use the registration/setup flow
- [ ] Create the very first account
- [ ] This first account becomes the `superuser`
- [ ] Log in with that account
- [ ] Open the Users page
- [ ] Create the rest of your staff accounts from there

## 11. Core App Smoke Test

- [ ] Log in successfully
- [ ] Create a user from Users page
- [ ] Create a customer
- [ ] Open the customer details page
- [ ] Create a loan linked to that customer
- [ ] Open the loan details page
- [ ] Change a loan status
- [ ] Delete and restore a customer or loan from recycle bin
- [ ] Confirm dashboard loads without errors

## 12. If You Need to Update the Site Later

- [ ] Make code changes locally
- [ ] If backend changed, push to GitHub so Render redeploys
- [ ] If frontend changed, run `npm run build` again
- [ ] Upload the fresh contents of `build/` to `public_html`

## Quick Fix Guide

### App opens, but buttons fail

- [ ] Check `REACT_APP_API_BASE_URL`
- [ ] Rebuild the frontend
- [ ] Re-upload `build/`
- [ ] Check Render service is live

### CORS error in browser

- [ ] Check `CORS_ORIGIN` in Render
- [ ] Make sure both `https://yourdomain.com` and `https://www.yourdomain.com` are included if needed
- [ ] Redeploy Render

### Render health check fails

- [ ] Check `MONGODB_URI`
- [ ] Check MongoDB Atlas network access
- [ ] Check MongoDB username/password

### Hostinger shows old page

- [ ] Delete old files from `public_html`
- [ ] Re-upload the new `build/` contents
- [ ] Clear browser cache
- [ ] Clear any Hostinger cache/CDN if enabled

## Safe Order To Follow

1. MongoDB Atlas
2. GitHub push
3. Render backend
4. Render env vars
5. Backend health check
6. `.env.production`
7. `npm run build`
8. Hostinger upload
9. Live login test
10. Create first superuser
11. Smoke test core pages
