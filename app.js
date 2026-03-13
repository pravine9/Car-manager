/* ──────────────────────────────────────────────────
   app.js — Car Tracker (Alpine.js + Dexie.js)
   ────────────────────────────────────────────────── */

// ── Dexie DB ──
const db = new Dexie('CarTrackerDB');
db.version(1).stores({
    cars: '++id, registration, timestamp'
});

// ── DVLA helper ──
async function dvlaLookup(reg) {
    const norm = reg.toUpperCase().replace(/\s+/g, '');
    if (!norm) return null;
    try {
        const res = await fetch('/api/vehicle-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationNumber: norm }),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

// ── Year from UK plate ──
function yearFromPlate(reg) {
    const norm = reg.toUpperCase().replace(/\s+/g, '');
    const m = norm.match(/^[A-Z]{2}(\d{2})[A-Z]{3}$/);
    if (!m) return null;
    const code = parseInt(m[1], 10);
    if (code >= 50 && code <= 99) return 2000 + (code - 50);
    if (code >= 0 && code <= 49) return 2000 + code;
    return null;
}

// ── URL cleaner ──
function cleanListingUrl(url) {
    try {
        const u = new URL(url);
        const h = u.hostname.toLowerCase();
        if (h.includes('autotrader.co.uk') || h.includes('motors.co.uk')) {
            return `${u.origin}${u.pathname}`;
        }
        return url;
    } catch { return url; }
}

// ── Format helpers ──
function fmtPrice(v) {
    if (!v && v !== 0) return '';
    return '£' + parseFloat(v).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtMileage(v) {
    if (!v && v !== 0) return '';
    return parseFloat(v).toLocaleString('en-GB');
}
function fmtEngineL(cc) {
    if (!cc) return '';
    return (cc / 1000).toFixed(1) + 'L';
}
function fmtDate(d) {
    if (!d) return '';
    try {
        return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return d; }
}

// ── Alpine component ──
document.addEventListener('alpine:init', () => {
    Alpine.data('carTracker', () => ({
        // State
        cars: [],
        search: '',
        sortCol: 'timestamp',
        sortDir: 'desc',
        modalOpen: false,
        editing: false,
        loading: false,
        dvlaMsg: '',

        // Form
        form: {
            id: null,
            registration: '',
            make: '',
            colour: '',
            year: '',
            engineCapacity: '',
            fuelType: '',
            motStatus: '',
            motExpiry: '',
            taxStatus: '',
            taxDueDate: '',
            monthOfFirstRegistration: '',
            co2: '',
            price: '',
            mileage: '',
            url: '',
            notes: '',
            starred: false,
        },

        // Quick add
        quickReg: '',
        quickUrl: '',

        // Init
        async init() {
            await this.loadCars();
        },

        async loadCars() {
            this.cars = await db.cars.toArray();
        },

        // ── Computed: filtered & sorted cars ──
        get filteredCars() {
            let list = [...this.cars];
            if (this.search) {
                const s = this.search.toLowerCase();
                list = list.filter(c =>
                    (c.registration || '').toLowerCase().includes(s) ||
                    (c.make || '').toLowerCase().includes(s) ||
                    (c.colour || '').toLowerCase().includes(s) ||
                    (c.notes || '').toLowerCase().includes(s) ||
                    (c.fuelType || '').toLowerCase().includes(s)
                );
            }
            list.sort((a, b) => {
                let av = a[this.sortCol] ?? '';
                let bv = b[this.sortCol] ?? '';
                const numCols = ['price', 'mileage', 'year', 'engineCapacity', 'co2'];
                if (numCols.includes(this.sortCol)) {
                    av = parseFloat(av) || 0;
                    bv = parseFloat(bv) || 0;
                    return this.sortDir === 'asc' ? av - bv : bv - av;
                }
                if (this.sortCol === 'timestamp') {
                    return this.sortDir === 'asc'
                        ? new Date(av || 0) - new Date(bv || 0)
                        : new Date(bv || 0) - new Date(av || 0);
                }
                return this.sortDir === 'asc'
                    ? String(av).localeCompare(String(bv))
                    : String(bv).localeCompare(String(av));
            });
            return list;
        },

        // ── Sort ──
        toggleSort(col) {
            if (this.sortCol === col) {
                this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortCol = col;
                this.sortDir = 'asc';
            }
        },
        sortIcon(col) {
            if (this.sortCol !== col) return '';
            return this.sortDir === 'asc' ? '↑' : '↓';
        },

        // ── Quick Add ──
        async quickAdd() {
            const reg = this.quickReg.trim().toUpperCase();
            if (!reg) { alert('Enter a registration.'); return; }

            const norm = reg.replace(/\s+/g, '');
            const exists = this.cars.find(c => (c.registration || '').replace(/\s+/g, '') === norm);
            if (exists) {
                if (confirm('This registration already exists. Edit it?')) {
                    this.openEdit(exists);
                    this.quickReg = '';
                    this.quickUrl = '';
                }
                return;
            }

            this.loading = true;
            const api = await dvlaLookup(norm);
            this.loading = false;

            this.resetForm();
            this.form.registration = norm;
            if (this.quickUrl) this.form.url = cleanListingUrl(this.quickUrl.trim());

            if (api) {
                this.form.make = api.make || '';
                this.form.colour = api.colour || '';
                this.form.year = api.yearOfManufacture != null ? String(api.yearOfManufacture) : '';
                this.form.engineCapacity = api.engineCapacity || '';
                this.form.fuelType = api.fuelType || '';
                this.form.motStatus = api.motStatus || '';
                this.form.motExpiry = api.motExpiryDate || '';
                this.form.taxStatus = api.taxStatus || '';
                this.form.taxDueDate = api.taxDueDate || '';
                this.form.monthOfFirstRegistration = api.monthOfFirstRegistration || '';
                this.form.co2 = api.co2Emissions || '';
            } else {
                const y = yearFromPlate(norm);
                if (y) this.form.year = String(y);
            }

            this.quickReg = '';
            this.quickUrl = '';
            this.editing = false;
            this.modalOpen = true;
        },

        // ── Modal: Add ──
        openAdd() {
            this.resetForm();
            this.editing = false;
            this.dvlaMsg = '';
            this.modalOpen = true;
        },

        // ── Modal: Edit ──
        openEdit(car) {
            this.form = { ...car };
            this.editing = true;
            this.dvlaMsg = '';
            this.modalOpen = true;
        },

        // ── Modal: Close ──
        closeModal() {
            this.modalOpen = false;
            this.dvlaMsg = '';
        },

        // ── Save ──
        async save() {
            if (!this.form.registration.trim()) { alert('Registration is required.'); return; }
            const data = { ...this.form };
            data.registration = data.registration.toUpperCase().replace(/\s+/g, '');
            if (data.url) data.url = cleanListingUrl(data.url);
            if (data.price) data.price = parseFloat(data.price) || null;
            if (data.mileage) data.mileage = parseFloat(data.mileage) || null;

            if (this.editing && data.id) {
                await db.cars.put(data);
            } else {
                delete data.id;
                data.timestamp = new Date().toISOString();
                data.starred = false;
                await db.cars.add(data);
            }
            await this.loadCars();
            this.closeModal();
        },

        // ── Delete ──
        async deleteCar(id) {
            if (!confirm('Delete this car?')) return;
            await db.cars.delete(id);
            await this.loadCars();
            if (this.modalOpen && this.form.id === id) this.closeModal();
        },

        // ── Star ──
        async toggleStar(car) {
            car.starred = !car.starred;
            await db.cars.put(car);
            await this.loadCars();
        },

        // ── DVLA Lookup (from modal) ──
        async lookupDvla() {
            const reg = this.form.registration.trim().toUpperCase().replace(/\s+/g, '');
            if (!reg) { alert('Enter a registration first.'); return; }
            this.loading = true;
            this.dvlaMsg = 'Looking up…';
            const api = await dvlaLookup(reg);
            this.loading = false;
            if (!api) { this.dvlaMsg = 'Not found or API unavailable.'; return; }
            this.form.make = api.make || this.form.make;
            this.form.colour = api.colour || this.form.colour;
            this.form.year = api.yearOfManufacture != null ? String(api.yearOfManufacture) : this.form.year;
            this.form.engineCapacity = api.engineCapacity || this.form.engineCapacity;
            this.form.fuelType = api.fuelType || this.form.fuelType;
            this.form.motStatus = api.motStatus || '';
            this.form.motExpiry = api.motExpiryDate || '';
            this.form.taxStatus = api.taxStatus || '';
            this.form.taxDueDate = api.taxDueDate || '';
            this.form.monthOfFirstRegistration = api.monthOfFirstRegistration || '';
            this.form.co2 = api.co2Emissions || '';
            const parts = [];
            if (api.motStatus) parts.push(`MOT: ${api.motStatus}`);
            if (api.motExpiryDate) parts.push(`expires ${fmtDate(api.motExpiryDate)}`);
            if (api.taxStatus) parts.push(`Tax: ${api.taxStatus}`);
            this.dvlaMsg = parts.join(' · ') || 'Details updated.';
        },

        // ── Export ──
        async exportData() {
            const cars = await db.cars.toArray();
            const blob = new Blob([JSON.stringify({ version: '2.0', exported: new Date().toISOString(), cars }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `car-tracker-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        },

        // ── Import ──
        async importData(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!confirm('Import cars from this file?')) { event.target.value = ''; return; }
            try {
                const json = JSON.parse(await file.text());
                const incoming = json.cars || [];
                const existingRegs = new Set(this.cars.map(c => (c.registration || '').replace(/\s+/g, '')));
                let imported = 0, skipped = 0;
                for (const car of incoming) {
                    const reg = (car.registration || '').replace(/\s+/g, '');
                    if (reg && existingRegs.has(reg)) { skipped++; continue; }
                    delete car.id;
                    car.timestamp = car.timestamp || new Date().toISOString();
                    await db.cars.add(car);
                    if (reg) existingRegs.add(reg);
                    imported++;
                }
                await this.loadCars();
                alert(`Done! ${imported} imported, ${skipped} skipped (duplicates).`);
            } catch (err) {
                alert('Import failed — check file format.');
                console.error(err);
            }
            event.target.value = '';
        },

        // ── Reset form ──
        resetForm() {
            this.form = {
                id: null, registration: '', make: '', colour: '', year: '',
                engineCapacity: '', fuelType: '', motStatus: '', motExpiry: '',
                taxStatus: '', taxDueDate: '', monthOfFirstRegistration: '', co2: '', price: '', mileage: '',
                url: '', notes: '', starred: false,
            };
            this.dvlaMsg = '';
        },

        // ── Road Tax Helper ──
        getTaxRate() {
            if (!window.vehicleTaxRates) return null;
            return window.vehicleTaxRates.getVehicleTaxRate(
                this.form.co2,
                this.form.monthOfFirstRegistration || this.form.year,
                this.form.engineCapacity
            );
        },

        // ── Format helpers (exposed to template) ──
        fmtPrice,
        fmtMileage,
        fmtEngineL,
        fmtDate,
    }));
});
