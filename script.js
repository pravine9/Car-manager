// Use shared utility from utils.js
const openInRightWindow = (url) => CarUtils.openInRightWindow(url);

// Paste from clipboard function
async function pasteFromClipboard(inputElement) {
    try {
        // Check if Clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            // Fallback: Use document.execCommand (deprecated but works in more contexts)
            inputElement.focus();
            const success = document.execCommand('paste');
            if (!success) {
                throw new Error('Clipboard API not available');
            }
            return;
        }
        
        // Use modern Clipboard API
        const text = await navigator.clipboard.readText();
        if (text) {
            inputElement.value = text.trim();
            inputElement.focus();
            // Trigger input event to update any auto-fill logic
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } catch (error) {
        console.error('Failed to paste from clipboard:', error);
        
        // Try fallback method
        try {
            inputElement.focus();
            // For file:// protocol or older browsers, try execCommand
            const success = document.execCommand('paste');
            if (success) {
                // Trigger input event
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
        } catch (fallbackError) {
            // Fallback also failed
        }
        
        // If both methods fail, show helpful message
        alert('Unable to paste from clipboard automatically.\n\nPlease:\n1. Click in the field\n2. Press Ctrl+V (or Cmd+V on Mac)\n\nOr ensure you\'re using a modern browser with clipboard permissions.');
    }
}

// Feature 1: VehicleScore Checker
// Paste button for registration input
document.getElementById('pasteRegistrationBtn').addEventListener('click', async function() {
    const input = document.getElementById('registrationInput');
    await pasteFromClipboard(input);
});

document.getElementById('checkScoreBtn').addEventListener('click', function() {
    const registration = document.getElementById('registrationInput').value.trim().toUpperCase();
    
    if (!registration) {
        alert('Please enter a registration number');
        return;
    }
    
    // Clean the registration (remove spaces)
    const cleanReg = CarUtils.normalizeRegistration(registration);
    const url = `https://vehiclescore.co.uk/score?registration=${cleanReg}`;
    
    // Open in new window on right half of screen
    CarUtils.openInRightWindow(url);
    
    // Auto-fill registration in Quick Add form (Step 3)
    const quickRegInput = document.getElementById('quickRegInput');
    if (quickRegInput) {
        quickRegInput.value = cleanReg;
    }
    
    saveInputs();
});

// Allow Enter key to trigger the button
document.getElementById('registrationInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('checkScoreBtn').click();
    }
});

// Use shared utility from utils.js
const cleanCarListingUrl = (url) => CarUtils.cleanCarListingUrl(url);

// Feature 2: URL Cleaner (Autotrader and Motors.co.uk)
// Paste button for URL input
document.getElementById('pasteUrlBtn').addEventListener('click', async function() {
    const input = document.getElementById('autotraderUrlInput');
    await pasteFromClipboard(input);
});

document.getElementById('cleanUrlBtn').addEventListener('click', function() {
    const url = document.getElementById('autotraderUrlInput').value.trim();
    
    if (!url) {
        alert('Please enter an Autotrader or Motors.co.uk URL');
        return;
    }
    
    const cleanedUrl = CarUtils.cleanCarListingUrl(url);
    
    if (cleanedUrl) {
        // Display the cleaned URL
        const outputBox = document.getElementById('cleanedUrlOutput');
        const linkElement = document.getElementById('cleanedUrlLink');
        
        linkElement.href = cleanedUrl;
        linkElement.textContent = cleanedUrl;
        outputBox.style.display = 'block';
        
        // Open the cleaned URL in a new window on right half of screen
        CarUtils.openInRightWindow(cleanedUrl);
        
        // Auto-fill URL in Quick Add form (Step 3)
        const quickUrlInput = document.getElementById('quickUrlInput');
        if (quickUrlInput) {
            quickUrlInput.value = cleanedUrl;
        }
        
        saveInputs();
    } else {
        alert('URL cleaner only works for Autotrader or Motors.co.uk links. Please enter a valid URL from one of these sites.');
    }
});

// Copy cleaned URL button
document.getElementById('copyUrlBtn').addEventListener('click', function() {
    const url = document.getElementById('cleanedUrlLink').textContent;
    navigator.clipboard.writeText(url).then(function() {
        CarUtils.showButtonFeedback(document.getElementById('copyUrlBtn'), 'Copied!');
    });
});

// Allow Enter key to trigger the clean button
document.getElementById('autotraderUrlInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('cleanUrlBtn').click();
    }
});

// Save input values to storage (for URL cleaner and vehicle score checker)
async function saveInputs() {
    try {
        await InputStorage.save('registration', document.getElementById('registrationInput').value);
        await InputStorage.save('autotraderUrl', document.getElementById('autotraderUrlInput').value);
    } catch (error) {
        console.error('Error saving inputs:', error);
    }
}

// Load input values from storage
async function loadInputs() {
    try {
        const inputs = await InputStorage.getAll();
        if (inputs.registration) document.getElementById('registrationInput').value = inputs.registration;
        if (inputs.autotraderUrl) document.getElementById('autotraderUrlInput').value = inputs.autotraderUrl;
    } catch (error) {
        console.error('Error loading inputs:', error);
    }
}

// Open VehicleScore for a registration
function openVehicleScore(registration) {
    const url = `https://vehiclescore.co.uk/score?registration=${CarUtils.normalizeRegistration(registration)}`;
    CarUtils.openInRightWindow(url);
}

// Copy log URL to clipboard
function copyLogUrl(url, buttonElement) {
    navigator.clipboard.writeText(url).then(function() {
        const originalColor = buttonElement.style.color;
        buttonElement.style.color = 'white';
        CarUtils.showButtonFeedback(buttonElement, 'Copied!');
        setTimeout(() => {
            buttonElement.style.color = originalColor;
        }, 2000);
    }).catch(function(err) {
        alert('Failed to copy URL. Please try again.');
    });
}

// Auto-select text when clicking on input fields
document.getElementById('registrationInput').addEventListener('focus', function() {
    this.select();
});

document.getElementById('autotraderUrlInput').addEventListener('focus', function() {
    this.select();
});

// Save inputs on change
document.getElementById('registrationInput').addEventListener('input', saveInputs);
document.getElementById('autotraderUrlInput').addEventListener('input', saveInputs);

// Initialize: Load inputs on page load
(async function() {
    await loadInputs();
})();
