# GitHub Pages Deployment Guide

## Quick Start

### Step 1: Initialize Git Repository (if not already done)
```bash
cd "/Users/pravine/VS Code/Cars"
git init
git add .
git commit -m "Initial commit: Car Management App with GitHub Pages support"
```

### Step 2: Create GitHub Repository
1. Go to [GitHub](https://github.com) and create a new repository
2. Name it (e.g., `car-manager` or `car-tools`)
3. **Do NOT** initialize with README, .gitignore, or license (we already have these)

### Step 3: Connect and Push
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

Replace:
- `YOUR_USERNAME` with your GitHub username
- `YOUR_REPO_NAME` with your repository name

### Step 4: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**:
   - Select `main` branch
   - Select `/ (root)` folder
5. Click **Save**
6. Wait 1-2 minutes for GitHub to build your site

### Step 5: Access Your Site
Your site will be live at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

## What's Included

- ✅ All project files ready for GitHub Pages
- ✅ Initial car data (`initial-data.json`) will auto-load on first visit
- ✅ Full car management functionality
- ✅ Export/Import features for data portability
- ✅ Responsive design works on all devices

## Updating Your Site

After making changes:
```bash
git add .
git commit -m "Description of changes"
git push
```

GitHub Pages will automatically rebuild your site (usually takes 1-2 minutes).

## Custom Domain (Optional)

To use a custom domain:
1. Add a `CNAME` file in the root with your domain name
2. Configure DNS settings with your domain provider
3. Update GitHub Pages settings to use your custom domain

## Troubleshooting

**Site not loading?**
- Check that GitHub Pages is enabled in Settings
- Verify the branch is set to `main` (or `master`)
- Wait a few minutes for the initial build

**Data not loading?**
- Check browser console for errors
- Verify `initial-data.json` is in the repository
- Try clearing browser cache

**Changes not appearing?**
- Make sure you pushed to the correct branch
- Wait 1-2 minutes for GitHub to rebuild
- Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)