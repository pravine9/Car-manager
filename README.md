# Car Tools - Vehicle Checker & Link Manager

A simple web application for managing car-related information with three main features:

## Features

### 1. Vehicle Score Checker
- Enter a UK car registration number
- Click "Check Score" to open VehicleScore.co.uk in a new tab
- Automatically formats the registration and opens the correct URL

### 2. AutoTrader URL Cleaner
- Paste a long AutoTrader URL with all query parameters
- Click "Clean URL" to get the shortened, clean version
- Copy the cleaned URL with one click

### 3. Car Log
- Store AutoTrader links and their associated registration numbers
- All entries are saved in browser localStorage (persists after refresh)
- Each entry has quick actions:
  - Open the AutoTrader link
  - Check VehicleScore for that registration
  - Delete the entry
- Clear all logs option available

## Usage

1. Open `index.html` in your web browser
2. Use any of the three features as needed
3. Your car log will persist even after closing and reopening the browser

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `script.js` - All functionality and localStorage management

## Browser Compatibility

Works in all modern browsers that support:
- localStorage
- ES6 JavaScript features
- CSS Grid and Flexbox
