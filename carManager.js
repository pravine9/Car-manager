// Car Details Manager - Handles adding, editing, and managing detailed car information

let currentEditingCarId = null;
let allCars = [];
let currentView = 'card'; // 'card' or 'table'
let currentFilters = {
    star: 'all',
    flag: 'all',
    transmission: 'all',
    fuelType: 'all'
};
let currentSort = {
    column: null,
    direction: 'asc' // 'asc' or 'desc'
};

// Form field IDs for car data
const CAR_FORM_FIELDS = [
    'carRegistration', 'carYear', 'carPrice', 'carMileage', 'carTransmission',
    'carEngineSize', 'carFuelType', 'carColors', 'carInsuranceGroup', 'carRating',
    'carSpec', 'carContact', 'carComments', 'carVehicleScore', 'carWebsiteLink'
];

// Fields that should NOT have the incomplete indicator
const EXCLUDE_FROM_HIGHLIGHT = ['carVehicleScore', 'carWebsiteLink'];

// Function to update field visual state (moved outside setupEventListeners for global access)
function updateFieldVisualState(input) {
    // Skip fields that shouldn't be highlighted
    if (EXCLUDE_FROM_HIGHLIGHT.includes(input.id)) {
        input.classList.remove('field-incomplete');
        return;
    }
    
    // Check if field has a value - handle different input types
    let hasValue = false;
    if (input.type === 'number') {
        hasValue = input.value !== '' && input.value !== null && !isNaN(parseFloat(input.value));
    } else if (input.tagName === 'SELECT') {
        hasValue = input.value !== '' && input.value !== null;
    } else {
        hasValue = input.value && input.value.trim() !== '';
    }
    
    if (hasValue) {
        input.classList.remove('field-incomplete');
    } else if (document.activeElement !== input) {
        input.classList.add('field-incomplete');
    } else {
        input.classList.remove('field-incomplete');
    }
}

// Initialize car manager
document.addEventListener('DOMContentLoaded', function() {
    initializeCarManager();
});

async function initializeCarManager() {
    await migrateLogsToCars(); // Migrate any existing log entries to cars
    await loadCars();
    setupEventListeners();
    switchView('card'); // Initialize with card view
    displayCars();
}

// Migrate existing log entries to car entries
async function migrateLogsToCars() {
    try {
        const logs = await LogStorage.getAll();
        if (logs.length === 0) return;
        
        const existingCars = await CarStorage.getAll();
        const existingRegistrations = new Set(existingCars.map(c => CarUtils.normalizeRegistration(c.registration || '')));
        
        let migrated = 0;
        for (const log of logs) {
            const reg = CarUtils.normalizeRegistration(log.registration || '');
            // Only migrate if we don't already have a car with this registration
            if (reg && !existingRegistrations.has(reg)) {
                const car = {
                    registration: reg,
                    websiteLink: log.url || '',
                    timestamp: log.timestamp || new Date().toISOString()
                };
                // Save will assign an ID automatically
                const savedId = await CarStorage.save(car);
                if (savedId) {
                    existingRegistrations.add(reg);
                    migrated++;
                }
            }
        }
        
        if (migrated > 0) {
            console.log(`Migrated ${migrated} log entries to car entries`);
            // Clear logs after migration
            await LogStorage.clear();
        }
    } catch (error) {
        console.error('Error migrating logs:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Add new car button (full form)
    document.getElementById('addNewCarBtn').addEventListener('click', showAddCarForm);
    
    // Quick add button
    document.getElementById('quickAddBtn').addEventListener('click', quickAddCar);
    
    // Quick add - Enter key support
    document.getElementById('quickUrlInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('quickRegInput').focus();
        }
    });
    document.getElementById('quickRegInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            quickAddCar();
        }
    });
    
    // Helper to auto-clean URLs on paste
    function setupUrlAutoClean(inputId) {
        document.getElementById(inputId).addEventListener('paste', function(e) {
            setTimeout(() => {
                const url = this.value.trim();
                if (url) {
                    const cleanedUrl = CarUtils.cleanCarListingUrl(url);
                    if (cleanedUrl) {
                        this.value = cleanedUrl;
                    }
                }
            }, 10);
        });
    }
    
    // Auto-clean URLs when pasted
    setupUrlAutoClean('quickUrlInput');
    
    // Form buttons
    document.getElementById('saveCarBtn').addEventListener('click', saveCar);
    document.getElementById('cancelCarBtn').addEventListener('click', cancelForm);
    document.getElementById('deleteCarBtn').addEventListener('click', deleteCurrentCar);
    
    // Link buttons
    document.getElementById('openVehicleScoreBtn').addEventListener('click', openVehicleScore);
    document.getElementById('openWebsiteLinkBtn').addEventListener('click', openWebsiteLink);
    document.getElementById('cleanWebsiteUrlBtn').addEventListener('click', cleanWebsiteUrl);
    
    // Search
    document.getElementById('searchCarsInput').addEventListener('input', function() {
        displayCars(this.value.trim());
    });
    
    // View toggle
    document.getElementById('cardViewBtn').addEventListener('click', function() {
        switchView('card');
    });
    document.getElementById('tableViewBtn').addEventListener('click', function() {
        switchView('table');
    });
    
    // Filters
    const filterConfig = [
        { id: 'filterStar', key: 'star' },
        { id: 'filterFlag', key: 'flag' },
        { id: 'filterTransmission', key: 'transmission' },
        { id: 'filterFuelType', key: 'fuelType' }
    ];
    
    filterConfig.forEach(({ id, key }) => {
        document.getElementById(id).addEventListener('change', function() {
            currentFilters[key] = this.value;
            applyFilters();
        });
    });
    
    document.getElementById('clearFiltersBtn').addEventListener('click', function() {
        filterConfig.forEach(({ id, key }) => {
            document.getElementById(id).value = 'all';
            currentFilters[key] = 'all';
        });
        applyFilters();
    });
    
    // Export/Import
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importDataInput').addEventListener('change', importData);
    
    // Table sorting - use event delegation since table might not exist yet
    document.addEventListener('click', function(e) {
        if (e.target.closest('.sortable')) {
            const header = e.target.closest('.sortable');
            const column = header.getAttribute('data-column');
            if (column) {
                sortTable(column);
            }
        }
    });
    
    // Auto-fill vehicle score URL and year when registration is entered
    function handleRegistrationChange(fillVehicleScore = false) {
        const registration = CarUtils.normalizeRegistration(document.getElementById('carRegistration').value);
        
        // Auto-fill vehicle score URL (only on blur)
        if (fillVehicleScore) {
            const vehicleScoreInput = document.getElementById('carVehicleScore');
            if (registration && !vehicleScoreInput.value.trim()) {
                vehicleScoreInput.value = `https://vehiclescore.co.uk/score?registration=${registration}`;
            }
        }
        
        // Auto-fill year from registration
        const yearInput = document.getElementById('carYear');
        if (registration && !yearInput.value.trim()) {
            const extractedYear = extractYearFromRegistration(registration);
            if (extractedYear) {
                yearInput.value = extractedYear;
            }
        }
    }
    
    document.getElementById('carRegistration').addEventListener('blur', () => handleRegistrationChange(true));
    document.getElementById('carRegistration').addEventListener('input', () => handleRegistrationChange(false));
    
    // Auto-clean Autotrader and Motors.co.uk URLs when pasted
    setupUrlAutoClean('carWebsiteLink');
    
    // Auto-save on input (debounced) and update visual indicators
    let saveTimeout;
    
    // Setup form field listeners
    CAR_FORM_FIELDS.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', function() {
                updateFieldVisualState(this);
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    if (currentEditingCarId) {
                        autoSaveCar();
                    }
                }, 2000);
            });
            
            input.addEventListener('blur', function() {
                setTimeout(() => updateFieldVisualState(this), 10);
            });
            
            input.addEventListener('focus', function() {
                this.classList.remove('field-incomplete');
            });
            
            input.addEventListener('change', function() {
                updateFieldVisualState(this);
            });
            
            updateFieldVisualState(input);
        }
    });
    
    // Scroll to top button functionality
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    
    if (scrollToTopBtn) {
        // Show/hide scroll to top button based on scroll position
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        });
        
        // Scroll to top when button is clicked
        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    } else {
        console.warn('scrollToTopBtn element not found');
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + N for new car
        if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            showAddCarForm();
        }
        // Escape to cancel
        if (e.key === 'Escape' && document.getElementById('carDetailsForm').style.display !== 'none') {
            cancelForm();
        }
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && document.getElementById('carDetailsForm').style.display !== 'none') {
            e.preventDefault();
            saveCar();
        }
    });
}

// Load all cars from storage
async function loadCars() {
    try {
        allCars = await CarStorage.getAll();
        // Migrate old localStorage data if needed
        if (allCars.length === 0) {
            const oldData = localStorage.getItem('carDetailsEntries');
            if (oldData) {
                allCars = JSON.parse(oldData);
                // Save to IndexedDB
                for (const car of allCars) {
                    await CarStorage.save(car);
                }
            }
        }
    } catch (error) {
        console.error('Error loading cars:', error);
        allCars = [];
    }
}

// Display cars in the list
function displayCars(searchTerm = '') {
    const searchInput = document.getElementById('searchCarsInput');
    const search = searchTerm || (searchInput ? searchInput.value.trim() : '');
    
    let filteredCars = applySearchAndFilters(allCars, search);
    
    updateCarsCount(filteredCars.length);
    
    if (currentView === 'table') {
        displayCarsTable(filteredCars);
    } else {
        displayCarsCards(filteredCars);
    }
}

// Apply search and filters
function applySearchAndFilters(cars, searchTerm = '') {
    let filtered = [...cars];
    
    // Apply search
    if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter(car => {
            return (
                (car.registration && car.registration.toLowerCase().includes(searchLower)) ||
                (car.spec && car.spec.toLowerCase().includes(searchLower)) ||
                (car.comments && car.comments.toLowerCase().includes(searchLower)) ||
                (car.contact && car.contact.toLowerCase().includes(searchLower)) ||
                (car.rating && String(car.rating).includes(searchLower))
            );
        });
    }
    
    // Apply filters
    if (currentFilters.star !== 'all') {
        filtered = filtered.filter(car => {
            const isStarred = car.starred === true;
            return currentFilters.star === 'starred' ? isStarred : !isStarred;
        });
    }
    
    if (currentFilters.flag !== 'all') {
        filtered = filtered.filter(car => {
            const isFlagged = car.flagged === true;
            return currentFilters.flag === 'flagged' ? isFlagged : !isFlagged;
        });
    }
    
    if (currentFilters.transmission !== 'all') {
        filtered = filtered.filter(car => car.transmission === currentFilters.transmission);
    }
    
    if (currentFilters.fuelType !== 'all') {
        filtered = filtered.filter(car => car.fuelType === currentFilters.fuelType);
    }
    
    // Apply sorting
    if (currentSort.column) {
        filtered = applySorting(filtered, currentSort.column, currentSort.direction);
    } else {
        // Default sort by timestamp (newest first)
        filtered.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp) : new Date(0);
            const timeB = b.timestamp ? new Date(b.timestamp) : new Date(0);
            return timeB - timeA;
        });
    }
    
    return filtered;
}

// Apply sorting to cars array
function applySorting(cars, column, direction) {
    const sorted = [...cars];
    
    sorted.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        // Handle null/undefined values
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';
        
        // Handle numeric columns
        if (column === 'price' || column === 'mileage' || column === 'engineSize' || 
            column === 'insuranceGroup' || column === 'rating' || column === 'year') {
            aVal = aVal === '' ? 0 : parseFloat(aVal) || 0;
            bVal = bVal === '' ? 0 : parseFloat(bVal) || 0;
            
            if (direction === 'asc') {
                return aVal - bVal;
            } else {
                return bVal - aVal;
            }
        }
        
        // Handle string columns
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        
        if (direction === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    return sorted;
}

// Sort table by column
function sortTable(column) {
    // Toggle direction if clicking the same column
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    // Update sort indicators
    updateSortIndicators();
    
    // Refresh display
    displayCars();
}

// Update sort indicators in table headers
function updateSortIndicators() {
    document.querySelectorAll('.sortable').forEach(header => {
        const column = header.getAttribute('data-column');
        const indicator = header.querySelector('.sort-indicator');
        
        if (indicator) {
            if (currentSort.column === column) {
                indicator.textContent = currentSort.direction === 'asc' ? ' ↑' : ' ↓';
                header.classList.add('sort-active');
            } else {
                indicator.textContent = '';
                header.classList.remove('sort-active');
            }
        }
    });
}

// Apply filters (called when filter changes)
function applyFilters() {
    displayCars();
}

// Switch between card and table view
function switchView(view) {
    currentView = view;
    
    const cardBtn = document.getElementById('cardViewBtn');
    const tableBtn = document.getElementById('tableViewBtn');
    const carsList = document.getElementById('carsList');
    const carsTableContainer = document.getElementById('carsTableContainer');
    
    if (view === 'table') {
        cardBtn.classList.remove('active');
        tableBtn.classList.add('active');
        if (carsList) carsList.style.display = 'none';
        if (carsTableContainer) carsTableContainer.style.display = 'block';
        // Update sort indicators when switching to table view
        updateSortIndicators();
    } else {
        cardBtn.classList.add('active');
        tableBtn.classList.remove('active');
        if (carsList) carsList.style.display = 'block';
        if (carsTableContainer) carsTableContainer.style.display = 'none';
    }
    
    displayCars();
}

// Setup comment tooltip
function setupCommentTooltip(element, fullComment) {
    if (!fullComment || fullComment.trim() === '') return;
    
    let tooltip = null;
    let timeout = null;
    
    element.addEventListener('mouseenter', function(e) {
        timeout = setTimeout(() => {
            tooltip = document.createElement('div');
            tooltip.className = 'comment-tooltip';
            tooltip.textContent = fullComment;
            document.body.appendChild(tooltip);
            
            // Position tooltip
            updateTooltipPosition(element, tooltip);
        }, 500); // Show after 500ms hover
    });
    
    element.addEventListener('mouseleave', function() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
    });
    
    element.addEventListener('mousemove', function(e) {
        if (tooltip) {
            updateTooltipPosition(element, tooltip);
        }
    });
}

// Update tooltip position
function updateTooltipPosition(element, tooltip) {
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
    
    // Adjust if tooltip goes off screen
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.left < 10) {
        tooltip.style.left = '10px';
    }
    if (tooltipRect.right > window.innerWidth - 10) {
        tooltip.style.left = (window.innerWidth - tooltipRect.width - 10) + 'px';
    }
    if (tooltipRect.top < 10) {
        tooltip.style.top = rect.bottom + 10 + 'px';
    }
}

// Update cars count display
function updateCarsCount(count) {
    const statsEl = document.getElementById('viewStats');
    if (statsEl) {
        const totalCount = allCars.length;
        statsEl.innerHTML = `<span id="carsCount">${count}</span> of ${totalCount} cars`;
    }
}

// Display cars in card view
function displayCarsCards(filteredCars) {
    const carsList = document.getElementById('carsList');
    const emptyMessage = document.getElementById('emptyCarsMessage');
    
    if (!carsList) {
        console.warn('carsList element not found');
        return;
    }
    
    if (filteredCars.length === 0) {
        if (emptyMessage) {
            emptyMessage.style.display = 'block';
        }
        carsList.innerHTML = '';
        return;
    }
    
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }
    
    carsList.innerHTML = filteredCars.map(car => createCarCard(car)).join('');
    
    // Add event listeners using helper function
    filteredCars.forEach(car => {
        if (!car.id) {
            console.warn('Car missing ID:', car);
            return;
        }
        attachCarActionListeners(car, 'card');
    });
}

// Helper function to attach action listeners for a car (works for both card and table views)
function attachCarActionListeners(car, viewType = 'card') {
    const baseSelector = `[data-car-id="${car.id}"]`;
    
    // Edit button - card uses 'edit-car-btn', table uses 'table-edit-btn'
    const editBtnSelector = viewType === 'card' ? '.edit-car-btn' : '.table-edit-btn';
    const editBtn = document.querySelector(`${baseSelector} ${editBtnSelector}`);
    if (editBtn) {
        editBtn.addEventListener('click', () => editCar(car.id));
    }
    
    // Delete button - card uses 'delete-car-btn', table uses 'table-delete-btn'
    const deleteBtnSelector = viewType === 'card' ? '.delete-car-btn' : '.table-delete-btn';
    const deleteBtn = document.querySelector(`${baseSelector} ${deleteBtnSelector}`);
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            if (viewType === 'card') {
                e.preventDefault();
                e.stopPropagation();
            }
            deleteCar(car.id);
        });
    }
    
    // Star button - card uses 'star-car-btn', table uses 'table-star-btn'
    const starBtnSelector = viewType === 'card' ? '.star-car-btn' : '.table-star-btn';
    const starBtn = document.querySelector(`${baseSelector} ${starBtnSelector}`);
    if (starBtn) {
        starBtn.addEventListener('click', (e) => {
            if (viewType === 'card') {
                e.preventDefault();
                e.stopPropagation();
            }
            toggleStar(car.id);
        });
    }
    
    // Flag button - card uses 'flag-car-btn', table uses 'table-flag-btn'
    const flagBtnSelector = viewType === 'card' ? '.flag-car-btn' : '.table-flag-btn';
    const flagBtn = document.querySelector(`${baseSelector} ${flagBtnSelector}`);
    if (flagBtn) {
        flagBtn.addEventListener('click', (e) => {
            if (viewType === 'card') {
                e.preventDefault();
                e.stopPropagation();
            }
            toggleFlag(car.id);
        });
    }
    
    // Vehicle score button - card uses 'open-vehicle-score-btn', table uses 'table-vehicle-score-btn'
    const vehicleScoreBtnSelector = viewType === 'card' ? '.open-vehicle-score-btn' : '.table-vehicle-score-btn';
    const vehicleScoreBtn = document.querySelector(`${baseSelector} ${vehicleScoreBtnSelector}`);
    if (vehicleScoreBtn && car.vehicleScore) {
        vehicleScoreBtn.addEventListener('click', () => {
            if (car.vehicleScore) CarUtils.openInRightWindow(car.vehicleScore);
        });
    }
    
    // Website link button - card uses 'open-website-link-btn', table uses 'table-website-link-btn'
    const websiteLinkBtnSelector = viewType === 'card' ? '.open-website-link-btn' : '.table-website-link-btn';
    const websiteLinkBtn = document.querySelector(`${baseSelector} ${websiteLinkBtnSelector}`);
    if (websiteLinkBtn && car.websiteLink) {
        websiteLinkBtn.addEventListener('click', () => {
            if (car.websiteLink) CarUtils.openInRightWindow(car.websiteLink);
        });
    }
}

// Display cars in table view
function displayCarsTable(filteredCars) {
    const tableBody = document.getElementById('carsTableBody');
    if (!tableBody) return;
    
    // Update sort indicators
    updateSortIndicators();
    
    if (filteredCars.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="18" style="text-align: center; padding: 40px; color: #999;">No cars match the current filters</td></tr>';
        return;
    }
    
    tableBody.innerHTML = filteredCars.map(car => createCarTableRow(car)).join('');
    
    // Add event listeners using helper function
    filteredCars.forEach(car => {
        if (!car.id) return;
        
        attachCarActionListeners(car, 'table');
        
        // Add comment hover tooltip (table-specific)
        const commentCell = document.querySelector(`[data-car-id="${car.id}"] .comment-cell`);
        if (commentCell) {
            const fullComment = commentCell.getAttribute('data-full-comment');
            if (fullComment && fullComment.trim() !== '') {
                setupCommentTooltip(commentCell, fullComment);
            }
        }
    });
}

// Escape HTML for safe attribute insertion
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create table row for a car
function createCarTableRow(car) {
    const price = CarUtils.formatPrice(car.price);
    const mileage = CarUtils.formatMileage(car.mileage);
    const rating = CarUtils.formatRating(car.rating);
    const displayUrl = CarUtils.formatUrlForDisplay(car.websiteLink, 50);
    
    // Escape comment for data attribute
    const escapedComment = escapeHtml(car.comments || '');
    const commentDisplay = car.comments ? (car.comments.length > 50 ? car.comments.substring(0, 50) + '...' : car.comments) : '';
    
    return `
        <tr data-car-id="${car.id}">
            <td class="sticky-col text-center" style="width: 50px;">
                <button class="table-star-btn ${car.starred ? 'starred' : ''}" title="${car.starred ? 'Remove from shortlist' : 'Add to shortlist'}">
                    ${car.starred ? '⭐' : '☆'}
                </button>
            </td>
            <td class="sticky-col text-center" style="width: 50px;">
                <button class="table-flag-btn ${car.flagged ? 'flagged' : ''}" title="${car.flagged ? 'Remove flag' : 'Flag this car'}">
                    ${car.flagged ? '🚩' : '⚐'}
                </button>
            </td>
            <td style="min-width: 120px;"><strong>${car.registration || ''}</strong></td>
            <td style="min-width: 80px;">${car.year || ''}</td>
            <td style="min-width: 180px;">${car.spec || ''}</td>
            <td style="min-width: 100px;">${price}</td>
            <td style="min-width: 100px;">${mileage}</td>
            <td style="min-width: 80px;">${car.engineSize ? car.engineSize + 'L' : ''}</td>
            <td style="min-width: 100px;">${car.transmission || ''}</td>
            <td style="min-width: 80px;">${car.fuelType || ''}</td>
            <td style="min-width: 120px;">${car.colors || ''}</td>
            <td style="min-width: 100px;">${car.insuranceGroup || ''}</td>
            <td style="min-width: 120px;">${rating}</td>
            <td style="min-width: 150px;">${car.contact || ''}</td>
            <td class="comment-cell" style="min-width: 200px; max-width: 300px;" data-full-comment="${escapedComment}">${commentDisplay}</td>
            <td style="min-width: 200px;">${car.websiteLink ? `<a href="${car.websiteLink}" target="_blank" class="table-link">${displayUrl}</a>` : ''}</td>
            <td style="min-width: 120px;">${car.vehicleScore ? `<a href="${car.vehicleScore}" target="_blank" class="table-link">View</a>` : ''}</td>
            <td class="sticky-col-right" style="min-width: 150px;">
                <div style="display: flex; gap: 5px; justify-content: flex-end;">
                    ${car.vehicleScore ? `<button class="table-vehicle-score-btn" title="Open Vehicle Score">📊</button>` : ''}
                    ${car.websiteLink ? `<button class="table-website-link-btn" title="Open Website">🔗</button>` : ''}
                    <button class="table-edit-btn" title="Edit">✏️</button>
                    <button class="table-delete-btn" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `;
}

// Toggle star (shortlist)
async function toggleStar(carId) {
    const car = allCars.find(c => c.id === carId);
    if (!car) return;
    
    car.starred = !car.starred;
    
    try {
        await CarStorage.save(car);
        await loadCars();
        displayCars();
    } catch (error) {
        console.error('Error toggling star:', error);
    }
}

// Toggle flag
async function toggleFlag(carId) {
    const car = allCars.find(c => c.id === carId);
    if (!car) return;
    
    car.flagged = !car.flagged;
    
    try {
        await CarStorage.save(car);
        await loadCars();
        displayCars();
    } catch (error) {
        console.error('Error toggling flag:', error);
    }
}

// Create car card HTML (handles both minimal and full entries)
function createCarCard(car) {
    const hasDetails = car.price || car.mileage || car.year || car.spec || car.comments;
    const isMinimal = !hasDetails && (car.websiteLink || car.registration);
    
    // Format values
    const price = car.price ? CarUtils.formatPrice(car.price) : null;
    const mileage = car.mileage ? CarUtils.formatMileage(car.mileage) : null;
    const year = car.year || null;
    const transmission = car.transmission || null;
    const fuelType = car.fuelType || null;
    const colors = car.colors || null;
    const spec = car.spec || null;
    const rating = car.rating || null;
    const ratingDisplay = rating ? CarUtils.formatRatingWithNumber(rating) : '';
    const displayUrl = car.websiteLink ? (() => {
        try {
            const urlObj = new URL(car.websiteLink);
            return `${urlObj.origin}${urlObj.pathname}`;
        } catch (e) {
            return car.websiteLink;
        }
    })() : '';
    
    return `
        <div class="car-card ${isMinimal ? 'car-card-minimal' : ''} ${car.starred ? 'car-card-starred' : ''} ${car.flagged ? 'car-card-flagged' : ''}" data-car-id="${car.id}">
            <div class="car-card-header">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="btn-icon star-car-btn ${car.starred ? 'starred' : ''}" title="${car.starred ? 'Remove from shortlist' : 'Add to shortlist'}" style="padding: 4px 8px; font-size: 1.2em; background: transparent; border: none;">
                            ${car.starred ? '⭐' : '☆'}
                        </button>
                        <button class="btn-icon flag-car-btn ${car.flagged ? 'flagged' : ''}" title="${car.flagged ? 'Remove flag' : 'Flag this car'}" style="padding: 4px 8px; font-size: 1.2em; background: transparent; border: none;">
                            ${car.flagged ? '🚩' : '⚐'}
                        </button>
                        <div class="car-card-reg">${car.registration || 'No Registration'}</div>
                    </div>
                    ${ratingDisplay ? `<div style="margin-top: 5px; font-size: 0.9em;">${ratingDisplay}</div>` : ''}
                </div>
                <div class="car-card-actions">
                    ${car.vehicleScore ? `<button class="btn-icon btn-open open-vehicle-score-btn" title="Open Vehicle Score">📊</button>` : ''}
                    ${car.websiteLink ? `<button class="btn-icon btn-open open-website-link-btn" title="Open Website">🔗</button>` : ''}
                    <button class="btn-icon btn-edit edit-car-btn" title="Edit">✏️</button>
                    <button class="btn-icon btn-delete delete-car-btn" title="Delete">🗑️</button>
                </div>
            </div>
            <div class="car-card-body">
                ${isMinimal ? `
                    <div class="car-card-row">
                        ${displayUrl ? `<span class="car-card-label">Website:</span> <span><a href="${car.websiteLink}" target="_blank" style="color: #667eea; text-decoration: none;">${displayUrl}</a></span>` : ''}
                    </div>
                    <div class="car-card-minimal-note" style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 6px; font-size: 0.9em; color: #856404;">
                        ⚠️ Minimal entry - Click "Edit" to add full details
                    </div>
                ` : `
                    ${year || price || mileage ? `<div class="car-card-row">
                        ${year ? `<span class="car-card-label">Year:</span> <span>${year}</span>` : ''}
                        ${price ? `<span class="car-card-label">Price:</span> <span>${price}</span>` : ''}
                        ${mileage ? `<span class="car-card-label">Mileage:</span> <span>${mileage}</span>` : ''}
                    </div>` : ''}
                    ${transmission || fuelType || car.engineSize ? `<div class="car-card-row">
                        ${transmission ? `<span class="car-card-label">Transmission:</span> <span>${transmission}</span>` : ''}
                        ${fuelType ? `<span class="car-card-label">Fuel:</span> <span>${fuelType}</span>` : ''}
                        ${car.engineSize ? `<span class="car-card-label">Engine:</span> <span>${car.engineSize}L</span>` : ''}
                    </div>` : ''}
                    ${colors || car.insuranceGroup ? `<div class="car-card-row">
                        ${colors ? `<span class="car-card-label">Colors:</span> <span>${colors}</span>` : ''}
                        ${car.insuranceGroup ? `<span class="car-card-label">Insurance Group:</span> <span>${car.insuranceGroup}</span>` : ''}
                    </div>` : ''}
                    ${ratingDisplay ? `<div class="car-card-row">
                        <span class="car-card-label">Rating:</span> <span>${ratingDisplay}</span>
                    </div>` : ''}
                    ${spec ? `<div class="car-card-row">
                        <span class="car-card-label">Spec:</span> <span class="car-card-spec">${spec}</span>
                    </div>` : ''}
                    ${displayUrl ? `<div class="car-card-row">
                        <span class="car-card-label">Website:</span> <span><a href="${car.websiteLink}" target="_blank" style="color: #667eea; text-decoration: none;">${displayUrl}</a></span>
                    </div>` : ''}
                    ${car.contact ? `<div class="car-card-row"><span class="car-card-label">Contact:</span> <span>${car.contact}</span></div>` : ''}
                    ${car.comments ? `<div class="car-card-row"><span class="car-card-label">Comments:</span> <span class="car-card-comments">${car.comments}</span></div>` : ''}
                `}
            </div>
        </div>
    `;
}

// Quick add car (minimal entry)
async function quickAddCar() {
    const url = document.getElementById('quickUrlInput').value.trim();
    const registration = document.getElementById('quickRegInput').value.trim().toUpperCase();
    
    if (!registration) {
        alert('Please enter a registration number');
        document.getElementById('quickRegInput').focus();
        return;
    }
    
    // Check if car with this registration already exists
    const normalizedReg = CarUtils.normalizeRegistration(registration);
    const existingCar = allCars.find(c => 
        c.registration && CarUtils.normalizeRegistration(c.registration) === normalizedReg
    );
    
    if (existingCar) {
        if (confirm('A car with this registration already exists. Do you want to edit it instead?')) {
            editCar(existingCar.id);
            // Clear quick add inputs
            document.getElementById('quickUrlInput').value = '';
            document.getElementById('quickRegInput').value = '';
            return;
        } else {
            return;
        }
    }
    
    // Clean URL if provided
    let cleanedUrl = url;
    if (url) {
        try {
            new URL(url); // Validate URL
            cleanedUrl = CarUtils.cleanCarListingUrl(url) || url;
        } catch (e) {
            alert('Invalid URL. The car will be saved without the URL.');
            cleanedUrl = '';
        }
    }
    
    // Extract year from registration
    const extractedYear = extractYearFromRegistration(registration);
    
    // Create minimal car entry
    const car = {
        registration: CarUtils.normalizeRegistration(registration),
        websiteLink: cleanedUrl,
        year: extractedYear ? String(extractedYear) : '',
        timestamp: new Date().toISOString()
    };
    
    try {
        const savedId = await CarStorage.save(car);
        await loadCars();
        
        const searchInput = document.getElementById('searchCarsInput');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        displayCars(searchTerm);
        
        // Clear quick add inputs
        const quickUrlInput = document.getElementById('quickUrlInput');
        const quickRegInput = document.getElementById('quickRegInput');
        if (quickUrlInput) quickUrlInput.value = '';
        if (quickRegInput) quickRegInput.value = '';
        
        // Scroll to the saved car card (don't open edit form for quick add)
        CarUtils.scrollToElementWithHighlight(`[data-car-id="${savedId}"]`);
    } catch (error) {
        console.error('Error saving car:', error);
        alert('Error saving car. Please try again.');
    }
}

// Show add car form
function showAddCarForm() {
    currentEditingCarId = null;
    document.getElementById('formTitle').textContent = 'Add New Car';
    document.getElementById('deleteCarBtn').style.display = 'none';
    clearForm();
    document.getElementById('carDetailsForm').style.display = 'block';
    document.getElementById('carRegistration').focus();
    
    // Scroll to form
    document.getElementById('carDetailsForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Edit car
async function editCar(carId) {
    const car = allCars.find(c => c.id === carId);
    if (!car) return;
    
    currentEditingCarId = carId;
    document.getElementById('formTitle').textContent = 'Edit Car';
    document.getElementById('deleteCarBtn').style.display = 'inline-block';
    
    // Populate form
    document.getElementById('carRegistration').value = car.registration || '';
    
    // Auto-fill year from registration if year is not already set
    const yearInput = document.getElementById('carYear');
    if (car.year) {
        yearInput.value = car.year;
    } else if (car.registration) {
        const extractedYear = extractYearFromRegistration(car.registration);
        if (extractedYear) {
            yearInput.value = extractedYear;
        }
    } else {
        yearInput.value = '';
    }
    
    // Set form values
    document.getElementById('carPrice').value = car.price != null ? car.price : '';
    document.getElementById('carMileage').value = car.mileage != null ? car.mileage : '';
    document.getElementById('carTransmission').value = car.transmission || 'Automatic';
    document.getElementById('carEngineSize').value = car.engineSize != null ? car.engineSize : '';
    document.getElementById('carFuelType').value = car.fuelType || 'Petrol';
    document.getElementById('carColors').value = car.colors || '';
    document.getElementById('carInsuranceGroup').value = car.insuranceGroup != null ? car.insuranceGroup : '';
    document.getElementById('carRating').value = car.rating != null ? car.rating : '';
    document.getElementById('carSpec').value = car.spec || '';
    document.getElementById('carContact').value = car.contact || '';
    document.getElementById('carComments').value = car.comments || '';
    document.getElementById('carVehicleScore').value = car.vehicleScore || '';
    document.getElementById('carWebsiteLink').value = car.websiteLink || '';
    
    // Update visual states after populating form
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            CAR_FORM_FIELDS.filter(id => !EXCLUDE_FROM_HIGHLIGHT.includes(id)).forEach(inputId => {
                const input = document.getElementById(inputId);
                if (input) {
                    updateFieldVisualState(input);
                }
            });
        });
    });
    
    document.getElementById('carDetailsForm').style.display = 'block';
    document.getElementById('carRegistration').focus();
    
    // Scroll to form
    document.getElementById('carDetailsForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Clear form
function clearForm() {
    document.getElementById('carRegistration').value = '';
    document.getElementById('carYear').value = '';
    document.getElementById('carPrice').value = '';
    document.getElementById('carMileage').value = '';
    document.getElementById('carTransmission').value = 'Automatic';
    document.getElementById('carEngineSize').value = '';
    document.getElementById('carFuelType').value = 'Petrol';
    document.getElementById('carColors').value = '';
    document.getElementById('carInsuranceGroup').value = '';
    document.getElementById('carRating').value = '';
    document.getElementById('carSpec').value = '';
    document.getElementById('carContact').value = '';
    document.getElementById('carComments').value = '';
    document.getElementById('carVehicleScore').value = '';
    document.getElementById('carWebsiteLink').value = '';
}

// Save car
async function saveCar() {
    const registration = document.getElementById('carRegistration').value.trim();
    
    if (!registration) {
        alert('Please enter a registration number');
        document.getElementById('carRegistration').focus();
        return;
    }
    
    const car = extractCarDataFromForm();
    
    if (currentEditingCarId) {
        car.id = currentEditingCarId;
        const existingCar = allCars.find(c => c.id === currentEditingCarId);
        preserveCarMetadata(car, existingCar);
    }
    
    try {
        const savedId = await CarStorage.save(car);
        await loadCars();
        
        const searchInput = document.getElementById('searchCarsInput');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        displayCars(searchTerm);
        cancelForm();
        
        // Scroll to the saved car card
        const carIdToFind = car.id || savedId;
        CarUtils.scrollToElementWithHighlight(`[data-car-id="${carIdToFind}"]`);
        
        // Show success feedback
        const saveBtn = document.getElementById('saveCarBtn');
        CarUtils.showButtonFeedback(saveBtn, '✓ Saved!');
    } catch (error) {
        console.error('Error saving car:', error);
        alert('Error saving car. Please try again.');
    }
}

// Auto-save car (for auto-save feature)
async function autoSaveCar() {
    if (!currentEditingCarId) return;
    
    const registration = document.getElementById('carRegistration').value.trim();
    if (!registration) return;
    
    const car = extractCarDataFromForm();
    car.id = currentEditingCarId;
    
    const existingCar = allCars.find(c => c.id === currentEditingCarId);
    preserveCarMetadata(car, existingCar);
    
    try {
        await CarStorage.save(car);
        await loadCars();
        const searchInput = document.getElementById('searchCarsInput');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        displayCars(searchTerm);
    } catch (error) {
        console.error('Error auto-saving car:', error);
    }
}

// Delete current car
function deleteCurrentCar() {
    if (currentEditingCarId && confirm('Are you sure you want to delete this car?')) {
        deleteCar(currentEditingCarId);
    }
}

// Delete car
async function deleteCar(carId) {
    if (!carId) {
        console.error('No car ID provided for deletion');
        alert('Error: No car ID found. Please try again.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this car?')) return;
    
    try {
        // Ensure carId is the correct type (IndexedDB uses numbers, but we might have strings)
        const idToDelete = typeof carId === 'string' ? parseInt(carId, 10) : carId;
        
        // Try to delete
        await CarStorage.delete(idToDelete);
        
        // Reload cars to refresh the list
        await loadCars();
        
        const searchInput = document.getElementById('searchCarsInput');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        displayCars(searchTerm);
        
        // If we were editing this car, close the form
        if (currentEditingCarId === carId || currentEditingCarId === idToDelete) {
            cancelForm();
        }
    } catch (error) {
        console.error('Error deleting car:', error);
        // Try fallback: find and delete by matching ID in all cars
        try {
            const cars = await CarStorage.getAll();
            const carToDelete = cars.find(c => c.id === carId || c.id === parseInt(carId, 10));
            if (carToDelete && carToDelete.id) {
                await CarStorage.delete(carToDelete.id);
                await loadCars();
                
                const searchInput = document.getElementById('searchCarsInput');
                const searchTerm = searchInput ? searchInput.value.trim() : '';
                displayCars(searchTerm);
                
                if (currentEditingCarId === carId) {
                    cancelForm();
                }
            } else {
                throw new Error('Car not found');
            }
        } catch (fallbackError) {
            console.error('Fallback delete also failed:', fallbackError);
            alert('Error deleting car. Please refresh the page and try again.');
        }
    }
}

// Cancel form
function cancelForm() {
    currentEditingCarId = null;
    document.getElementById('carDetailsForm').style.display = 'none';
    clearForm();
}

// Open vehicle score
function openVehicleScore() {
    const url = document.getElementById('carVehicleScore').value.trim();
    if (url) {
        CarUtils.openInRightWindow(url);
    } else {
        alert('Please enter a vehicle score URL first');
    }
}

// Open website link
function openWebsiteLink() {
    const url = document.getElementById('carWebsiteLink').value.trim();
    if (url) {
        CarUtils.openInRightWindow(url);
    } else {
        alert('Please enter a website URL first');
    }
}

// Helper function to extract year from UK number plate (current format only: 2001+)
function extractYearFromRegistration(registration) {
    if (!registration) return null;
    
    const reg = CarUtils.normalizeRegistration(registration);
    const match = reg.match(/^[A-Z]{2}(\d{2})[A-Z]{3}$/);
    if (match) {
        const yearCode = parseInt(match[1], 10);
        
        // Year codes 50-99: September-February of year 2000 + (code - 50)
        if (yearCode >= 50 && yearCode <= 99) {
            return 2000 + (yearCode - 50);
        }
        
        // Year codes 0-49: March-August of year 2000 + code
        if (yearCode >= 0 && yearCode <= 49) {
            return 2000 + yearCode;
        }
    }
    
    return null;
}

// Extract car data from form fields
function extractCarDataFromForm() {
    return {
        registration: CarUtils.normalizeRegistration(document.getElementById('carRegistration').value),
        year: document.getElementById('carYear').value.trim(),
        price: document.getElementById('carPrice').value ? parseFloat(document.getElementById('carPrice').value) : null,
        mileage: document.getElementById('carMileage').value ? parseFloat(document.getElementById('carMileage').value) : null,
        transmission: document.getElementById('carTransmission').value,
        engineSize: document.getElementById('carEngineSize').value ? parseFloat(document.getElementById('carEngineSize').value) : null,
        fuelType: document.getElementById('carFuelType').value,
        colors: document.getElementById('carColors').value.trim(),
        insuranceGroup: document.getElementById('carInsuranceGroup').value ? parseInt(document.getElementById('carInsuranceGroup').value) : null,
        rating: document.getElementById('carRating').value ? parseInt(document.getElementById('carRating').value) : null,
        spec: document.getElementById('carSpec').value.trim(),
        contact: document.getElementById('carContact').value.trim(),
        comments: document.getElementById('carComments').value.trim(),
        vehicleScore: document.getElementById('carVehicleScore').value.trim(),
        websiteLink: document.getElementById('carWebsiteLink').value.trim()
    };
}

// Preserve existing car metadata (timestamp, starred, flagged)
function preserveCarMetadata(car, existingCar) {
    if (existingCar) {
        car.timestamp = existingCar.timestamp;
        car.starred = existingCar.starred || false;
        car.flagged = existingCar.flagged || false;
    }
    return car;
}

// Clean website URL (for Autotrader and Motors.co.uk)
function cleanWebsiteUrl() {
    const urlInput = document.getElementById('carWebsiteLink');
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('Please enter a URL first');
        return;
    }
    
    const cleanedUrl = CarUtils.cleanCarListingUrl(url);
    
    if (cleanedUrl) {
        urlInput.value = cleanedUrl;
        CarUtils.openInRightWindow(cleanedUrl);
        CarUtils.showButtonFeedback(document.getElementById('cleanWebsiteUrlBtn'), '✓ Cleaned!');
    } else {
        alert('URL cleaner only works for Autotrader or Motors.co.uk links');
    }
}

// Export data
async function exportData() {
    try {
        const cars = await CarStorage.getAll();
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            cars: cars
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `car-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Show success feedback
        CarUtils.showButtonFeedback(document.getElementById('exportDataBtn'), '✓ Exported!');
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data. Please try again.');
    }
}

// Import data
async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!confirm('Importing data will add all cars from the file to your current collection. Continue?')) {
        event.target.value = ''; // Reset file input
        return;
    }
    
    try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!importData.cars || !Array.isArray(importData.cars)) {
            throw new Error('Invalid file format');
        }
        
        let imported = 0;
        let skipped = 0;
        const existingRegistrations = new Set(allCars.map(c => CarUtils.normalizeRegistration(c.registration || '')));
        
        for (const car of importData.cars) {
            // Skip if car with same registration already exists
            const reg = CarUtils.normalizeRegistration(car.registration || '');
            if (reg && existingRegistrations.has(reg)) {
                skipped++;
                continue;
            }
            
            // Remove ID to create new entries
            delete car.id;
            car.timestamp = car.timestamp || new Date().toISOString();
            
            await CarStorage.save(car);
            if (reg) {
                existingRegistrations.add(reg);
            }
            imported++;
        }
        
        await loadCars();
        displayCars();
        
        // Reset file input
        event.target.value = '';
        
        alert(`Import complete!\n${imported} cars imported\n${skipped} cars skipped (duplicate registrations)`);
    } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing data. Please check the file format and try again.');
        event.target.value = ''; // Reset file input
    }
}

// Export function to be used by other scripts
if (typeof window !== 'undefined') {
    window.CarManager = {
        loadCars,
        displayCars,
        showAddCarForm,
        editCar,
        exportData,
        importData
    };
}
