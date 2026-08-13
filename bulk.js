/* ──────────────────────────────────────────────────
   bulk.js — standalone Bulk DVLA Lookup → CSV page
   ────────────────────────────────────────────────── */

// Full DVLA Vehicle Enquiry Service (VES) response field set.
// Every field the API can return is included as a CSV column so
// whatever subset you need is always present in the export.
const DVLA_COLUMNS = [
    { header: 'Registration', key: 'registrationNumber' },
    { header: 'Make', key: 'make' },
    { header: 'Colour', key: 'colour' },
    { header: 'Fuel Type', key: 'fuelType' },
    { header: 'Engine Capacity (cc)', key: 'engineCapacity' },
    { header: 'CO2 Emissions', key: 'co2Emissions' },
    { header: 'Euro Status', key: 'euroStatus' },
    { header: 'Real Driving Emissions', key: 'realDrivingEmissions' },
    { header: 'Year of Manufacture', key: 'yearOfManufacture' },
    { header: 'Month of First Registration', key: 'monthOfFirstRegistration' },
    { header: 'Month of First DVLA Registration', key: 'monthOfFirstDvlaRegistration' },
    { header: 'Tax Status', key: 'taxStatus' },
    { header: 'Tax Due Date', key: 'taxDueDate' },
    { header: 'MOT Status', key: 'motStatus' },
    { header: 'MOT Expiry Date', key: 'motExpiryDate' },
    { header: 'ART End Date', key: 'artEndDate' },
    { header: 'Marked for Export', key: 'markedForExport' },
    { header: 'Type Approval', key: 'typeApproval' },
    { header: 'Wheelplan', key: 'wheelplan' },
    { header: 'Revenue Weight', key: 'revenueWeight' },
    { header: 'Date of Last V5C Issued', key: 'dateOfLastV5CIssued' },
    { header: 'Automated Vehicle', key: 'automatedVehicle' },
];

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

document.addEventListener('alpine:init', () => {
    Alpine.data('bulkDvla', () => ({
        columns: DVLA_COLUMNS,
        input: '',
        running: false,
        results: [],
        done: 0,
        total: 0,

        get canDownload() {
            return !this.running && this.results.length > 0;
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

        async runLookup() {
            const regs = this.parseRegList(this.input);
            if (regs.length === 0) { alert('Paste at least one registration.'); return; }

            this.running = true;
            this.results = [];
            this.total = regs.length;
            this.done = 0;

            for (const reg of regs) {
                const api = await dvlaLookup(reg);
                const row = api
                    ? { reg, ok: true, data: api }
                    : { reg, ok: false, data: { registrationNumber: reg } };
                // Reassign (not push) so Alpine reliably re-evaluates bindings.
                this.results = [...this.results, row];
                this.done++;
            }

            this.running = false;
        },

        csvCell(v) {
            if (v == null) return '';
            const s = String(v);
            if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        },

        downloadCsv() {
            if (this.results.length === 0) return;
            const rows = [this.columns.map(c => c.header).join(',')];
            for (const r of this.results) {
                rows.push(this.columns.map(c => this.csvCell(r.data?.[c.key])).join(','));
            }
            // Prepend UTF-8 BOM so Excel opens it with correct encoding.
            const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `dvla-vehicles-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
        },
    }));
});
