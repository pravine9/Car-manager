/* ──────────────────────────────────────────────────
   app.js — Car Tracker (Alpine.js + Vercel Postgres)
   ────────────────────────────────────────────────── */

// ── Collection Detection ──
// Detect collection from URL path (e.g. /my-ford-collection)
const getCollectionName = () => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    return path || 'main';
};

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
        collection: getCollectionName(),

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

        // Bulk DVLA → CSV
        bulkOpen: false,
        bulkInput: '',
        bulkRunning: false,
        bulkResults: [],
        bulkDone: 0,
        bulkTotal: 0,

        // Init
        async init() {
            await this.loadCars();
        },

        async loadCars() {
            this.loading = true;
            try {
                const res = await fetch(`/api/cars?collection=${this.collection}`);
                if (res.ok) {
                    this.cars = await res.json();
                }
            } catch (err) {
                console.error('Load failed:', err);
            } finally {
                this.loading = false;
            }
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
                if (confirm('This registration already exists in this collection. Edit it?')) {
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
            // Fix field names for DB (snake_case from API -> camelCase for form)
            if (car.engine_capacity) this.form.engineCapacity = car.engine_capacity;
            if (car.fuel_type) this.form.fuelType = car.fuel_type;
            if (car.mot_status) this.form.motStatus = car.mot_status;
            if (car.mot_expiry) this.form.motExpiry = car.mot_expiry.split('T')[0];
            if (car.tax_status) this.form.taxStatus = car.tax_status;
            if (car.tax_due_date) this.form.taxDueDate = car.tax_due_date.split('T')[0];
            if (car.month_of_first_registration) this.form.monthOfFirstRegistration = car.month_of_first_registration;
            
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

            this.loading = true;
            try {
                const res = await fetch(`/api/cars?collection=${this.collection}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) {
                    await this.loadCars();
                    this.closeModal();
                } else {
                    const err = await res.json();
                    alert('Save failed: ' + (err.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Save failed — check console.');
                console.error(err);
            } finally {
                this.loading = false;
            }
        },

        // ── Delete ──
        async deleteCar(id) {
            if (!confirm('Delete this car from the server?')) return;
            this.loading = true;
            try {
                const res = await fetch(`/api/cars?collection=${this.collection}&id=${id}`, {
                    method: 'DELETE',
                });
                if (res.ok) {
                    await this.loadCars();
                    if (this.modalOpen && this.form.id === id) this.closeModal();
                }
            } catch (err) {
                console.error('Delete failed:', err);
            } finally {
                this.loading = false;
            }
        },

        // ── Star ──
        async toggleStar(car) {
            const old = car.starred;
            car.starred = !car.starred;
            try {
                const res = await fetch(`/api/cars?collection=${this.collection}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: car.id, starred: car.starred }),
                });
                if (!res.ok) car.starred = old; // Revert on failure
            } catch {
                car.starred = old;
            }
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
            const blob = new Blob([JSON.stringify({ 
                version: '3.0 (postgres)', 
                collection: this.collection,
                exported: new Date().toISOString(), 
                cars: this.cars 
            }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `car-tracker-${this.collection}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        },

        // ── Import (Note: would need bulk API for large files) ──
        async importData(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!confirm(`Import cars into "${this.collection}"?`)) { event.target.value = ''; return; }
            try {
                const json = JSON.parse(await file.text());
                const incoming = json.cars || [];
                alert(`Importing ${incoming.length} cars... please wait.`);
                for (const car of incoming) {
                    delete car.id; // Treat as new entries
                    await fetch(`/api/cars?collection=${this.collection}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(car),
                    });
                }
                await this.loadCars();
                alert('Import finished.');
            } catch (err) {
                alert('Import failed.');
                console.error(err);
            }
            event.target.value = '';
        },

        // ── Bulk DVLA → CSV ──
        // Default column set per the DVLA vehicle parser spec.
        bulkColumns: [
            { header: 'Registration', key: 'registrationNumber' },
            { header: 'Make', key: 'make' },
            { header: 'Colour', key: 'colour' },
            { header: 'Fuel Type', key: 'fuelType' },
            { header: 'Engine Capacity (cc)', key: 'engineCapacity' },
            { header: 'CO2 Emissions', key: 'co2Emissions' },
            { header: 'Euro Status', key: 'euroStatus' },
            { header: 'Year of Manufacture', key: 'yearOfManufacture' },
            { header: 'Month of First Registration', key: 'monthOfFirstRegistration' },
        ],

        openBulk() {
            this.bulkInput = '';
            this.bulkResults = [];
            this.bulkDone = 0;
            this.bulkTotal = 0;
            this.bulkRunning = false;
            this.bulkOpen = true;
        },

        closeBulk() {
            if (this.bulkRunning) return;
            this.bulkOpen = false;
        },

        parseRegList(text) {
            const seen = new Set();
            const list = [];
            for (const raw of (text || '').split(/[\n\r,;\t]+/)) {
                const reg = raw.trim().toUpperCase().replace(/\s+/g, '');
                if (!reg || seen.has(reg)) continue;
                seen.add(reg);
                list.push(reg);
            }
            return list;
        },

        async runBulkLookup() {
            const regs = this.parseRegList(this.bulkInput);
            if (regs.length === 0) { alert('Paste at least one registration.'); return; }

            this.bulkRunning = true;
            this.bulkResults = [];
            this.bulkTotal = regs.length;
            this.bulkDone = 0;

            for (const reg of regs) {
                const api = await dvlaLookup(reg);
                if (api) {
                    this.bulkResults.push({ reg, ok: true, data: api });
                } else {
                    this.bulkResults.push({ reg, ok: false, data: { registrationNumber: reg } });
                }
                this.bulkDone++;
            }

            this.bulkRunning = false;
        },

        csvCell(v) {
            if (v == null) return '';
            const s = String(v);
            if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        },

        downloadBulkCsv() {
            if (this.bulkResults.length === 0) return;
            const rows = [this.bulkColumns.map(c => c.header).join(',')];
            for (const r of this.bulkResults) {
                rows.push(this.bulkColumns.map(c => this.csvCell(r.data?.[c.key])).join(','));
            }
            // utf-8-sig BOM so Excel opens it correctly
            const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `dvla-vehicles-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
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
