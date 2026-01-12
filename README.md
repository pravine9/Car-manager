# Car Tools - Vehicle Checker & Link Manager

<!-- Updated for GitHub Pages deployment -->

A comprehensive web application for managing car-related information with powerful features for tracking and evaluating vehicles.

## Features

### 1. Vehicle Score Checker
- Enter a UK car registration number
- Click "Check Score" to open VehicleScore.co.uk in a new tab
- Automatically formats the registration and opens the correct URL

### 2. AutoTrader URL Cleaner
- Paste a long AutoTrader or Motors.co.uk URL with all query parameters
- Click "Clean URL" to get the shortened, clean version
- Copy the cleaned URL with one click

### 3. Car Management System
- **Quick Add**: Quickly add cars with just URL and registration
- **Full Details**: Add comprehensive car information including:
  - Registration, year, price, mileage
  - Engine size, transmission, fuel type
  - Colors, insurance group, rating
  - Contact information, comments
  - Vehicle score and website links
- **Card & Table Views**: Switch between visual card view and detailed table view
- **Search & Filter**: Search cars and filter by star status, flags, transmission, and fuel type
- **Sort**: Sort by any column in table view
- **Star & Flag**: Mark favorites and flag items for attention
- **Export/Import**: Export your data as JSON or import existing data
- All data is saved automatically using IndexedDB (with localStorage fallback)

## Usage

### Local Development
1. Open `index.html` in your web browser
2. Use any of the features as needed
3. Your data will persist even after closing and reopening the browser

### GitHub Pages Deployment

This project is configured for GitHub Pages deployment. To deploy:

1. **Create a GitHub repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to your repository on GitHub
   - Click on **Settings**
   - Scroll down to **Pages** section
   - Under **Source**, select `main` branch (or `master` if that's your default)
   - Select `/ (root)` as the folder
   - Click **Save**

3. **Access your site**
   - Your site will be available at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`
   - GitHub Pages may take a few minutes to build and deploy

4. **Initial Data**
   - The app automatically loads `initial-data.json` on first visit if no existing data is found
   - Users can still export/import their own data using the built-in features

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `script.js` - Vehicle checker and URL cleaner functionality
- `carManager.js` - Car management system (add, edit, delete, search, filter)
- `storage.js` - IndexedDB storage layer with localStorage fallback
- `utils.js` - Shared utility functions
- `initial-data.json` - Pre-loaded car data (loaded automatically on first visit)

## Browser Compatibility

Works in all modern browsers that support:
- IndexedDB (with localStorage fallback)
- ES6 JavaScript features
- CSS Grid and Flexbox
- Fetch API

## Data Storage

- **Primary**: IndexedDB (persists across browser sessions and different ports)
- **Fallback**: localStorage (for older browsers or when IndexedDB fails)
- **Export/Import**: JSON format for easy data portability

## License

Free to use and modify as needed.
