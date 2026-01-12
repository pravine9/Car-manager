// Shared utilities for Car Tools application

// Helper function to open URL in right half of screen
function openInRightWindow(url) {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const windowWidth = Math.floor(screenWidth / 2);
    const windowHeight = screenHeight - 100; // Leave some margin
    const left = Math.floor(screenWidth / 2); // Start at right half
    const top = 50; // Small top margin
    
    window.open(url, '_blank', `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`);
}

// Helper function to clean URLs (Autotrader and Motors.co.uk)
function cleanCarListingUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Clean Autotrader URLs
        if (hostname.includes('autotrader.co.uk') || hostname.includes('autotrader.com')) {
            return `${urlObj.origin}${urlObj.pathname}`;
        }
        
        // Clean Motors.co.uk URLs
        if (hostname.includes('motors.co.uk')) {
            return `${urlObj.origin}${urlObj.pathname}`;
        }
        
        return null; // Not a supported URL
    } catch (error) {
        return null; // Invalid URL
    }
}

// Helper function to show button feedback (success state)
function showButtonFeedback(button, successText = '✓ Done!', duration = 2000) {
    const originalText = button.textContent;
    const originalBackground = button.style.background;
    
    button.textContent = successText;
    button.style.background = '#48bb78';
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalBackground;
    }, duration);
}

// Helper function to scroll to element with highlight effect
function scrollToElementWithHighlight(selector, delay = 200) {
    setTimeout(() => {
        const element = document.querySelector(selector);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
            // Add highlight effect
            element.style.transition = 'box-shadow 0.3s';
            element.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.5)';
            setTimeout(() => {
                element.style.boxShadow = '';
            }, 2000);
        }
    }, delay);
}

// Helper function to normalize registration number
function normalizeRegistration(registration) {
    return registration ? registration.toUpperCase().replace(/\s+/g, '') : '';
}

// Helper function to format price
function formatPrice(price) {
    if (!price) return '';
    return `£${parseFloat(price).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper function to format mileage
function formatMileage(mileage) {
    if (!mileage) return '';
    return parseFloat(mileage).toLocaleString('en-GB');
}

// Helper function to format rating display
function formatRating(rating) {
    if (!rating) return '';
    const stars = '⭐'.repeat(rating);
    const emptyStars = '☆'.repeat(5 - rating);
    return `${stars}${emptyStars}`;
}

// Helper function to format rating with number
function formatRatingWithNumber(rating) {
    if (!rating) return '';
    const stars = '⭐'.repeat(rating);
    const emptyStars = '☆'.repeat(5 - rating);
    return `<span style="font-size: 1.1em;">${stars}${emptyStars}</span> <span style="color: #666;">(${rating}/5)</span>`;
}

// Helper function to format URL for display
function formatUrlForDisplay(url, maxLength = 50) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        const displayUrl = `${urlObj.hostname}${urlObj.pathname.substring(0, 40)}${urlObj.pathname.length > 40 ? '...' : ''}`;
        return displayUrl.length > maxLength ? displayUrl.substring(0, maxLength) + '...' : displayUrl;
    } catch (e) {
        return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
    }
}

// Export utilities to global scope
if (typeof window !== 'undefined') {
    window.CarUtils = {
        openInRightWindow,
        cleanCarListingUrl,
        showButtonFeedback,
        scrollToElementWithHighlight,
        normalizeRegistration,
        formatPrice,
        formatMileage,
        formatRating,
        formatRatingWithNumber,
        formatUrlForDisplay
    };
}
