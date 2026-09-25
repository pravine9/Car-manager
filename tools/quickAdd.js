// Quick Add: press Cmd+K (Ctrl+K) anywhere. The app takes the plate you typed or read last,
// looks it up on DVLA (through server.py), shows the details, and Enter adds the car.
const QuickAdd = (() => {
    const cache = new Map(); // registration -> DVLA result, so a second open is instant
    let lastRegSource = 'registrationInput';
    let state = null; // { reg, url, status: 'loading'|'ready'|'error'|'duplicate', data, existing, confirmWhenReady }

    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const titleCase = s => String(s || '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function formatDate(iso) {
        const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso || '');
        if (!m) return '';
        return `${m[3] ? Number(m[3]) + ' ' : ''}${months[Number(m[2]) - 1]} ${m[1]}`;
    }

    // "LW16PZF" -> "LW16 PZF" for display
    function prettyReg(reg) {
        return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(reg) ? `${reg.slice(0, 4)} ${reg.slice(4)}` : reg;
    }

    function fuel(dvlaFuel) {
        const f = String(dvlaFuel || '').toUpperCase();
        if (!f) return '';
        if (f.includes('HYBRID')) return 'Hybrid';
        if (f.startsWith('ELECTRIC')) return 'Electric';
        return titleCase(f);
    }

    async function lookup(reg) {
        if (cache.has(reg)) return cache.get(reg);
        const res = await fetch('/api/vehicle-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationNumber: reg })
        });
        const data = await res.json().catch(() => ({}));
        const result = res.ok
            ? { ok: true, data }
            : { ok: false, message: res.status === 404 ? 'Not found on DVLA' : 'DVLA lookup failed' };
        if (res.ok || res.status === 404) cache.set(reg, result);
        return result;
    }

    // The car to save, in the same shape as a car from the full form
    function buildCar() {
        const d = state.data || {};
        const car = {
            registration: state.reg,
            websiteLink: state.url,
            vehicleScore: `https://vehiclescore.co.uk/score?registration=${state.reg}`,
            timestamp: new Date().toISOString()
        };
        if (d.make) car.spec = titleCase(d.make);
        if (d.yearOfManufacture) car.year = String(d.yearOfManufacture);
        else {
            const y = extractYearFromRegistration(state.reg);
            if (y) car.year = String(y);
        }
        if (d.engineCapacity) car.engineSize = Math.round(d.engineCapacity / 100) / 10;
        if (d.fuelType) car.fuelType = fuel(d.fuelType);
        if (d.colour) car.colors = titleCase(d.colour);
        const notes = [];
        if (d.motStatus) notes.push(`MOT: ${d.motStatus}${d.motExpiryDate ? ' until ' + formatDate(d.motExpiryDate) : ''}`);
        if (d.taxStatus) notes.push(`Tax: ${d.taxStatus}${d.taxDueDate ? ' (due ' + formatDate(d.taxDueDate) + ')' : ''}`);
        if (notes.length) car.comments = notes.join(' · ');
        if (state.data) car.dvla = state.data;
        return car;
    }

    function render() {
        const d = state.data || {};
        $('qaPlate').textContent = prettyReg(state.reg);
        $('qaTitle').textContent = state.data
            ? [titleCase(d.make), d.yearOfManufacture, titleCase(d.colour)].filter(Boolean).join(' · ')
            : '';

        let body = '';
        if (state.status === 'loading') {
            body = '<p class="qa-note">Looking up DVLA…</p>';
        } else if (state.status === 'duplicate') {
            body = '<p class="qa-note">This car is already in your list.</p>';
        } else if (state.status === 'error') {
            body = `<p class="qa-note qa-warn">${esc(state.message)}. Enter adds the plate only.</p>`;
        } else {
            const rows = [
                ['Fuel', fuel(d.fuelType)],
                ['Engine', d.engineCapacity ? `${(d.engineCapacity / 1000).toFixed(1)}L (${d.engineCapacity}cc)` : ''],
                ['First registered', formatDate(d.monthOfFirstRegistration)],
                ['MOT', d.motStatus ? `${d.motStatus}${d.motExpiryDate ? ' until ' + formatDate(d.motExpiryDate) : ''}` : ''],
                ['Tax', d.taxStatus ? `${d.taxStatus}${d.taxDueDate ? ' · due ' + formatDate(d.taxDueDate) : ''}` : ''],
                ['CO₂', d.co2Emissions ? `${d.co2Emissions} g/km` : '']
            ].filter(([, v]) => v);
            body = `<dl class="qa-grid">${rows.map(([k, v]) => {
                const bad = (k === 'MOT' && !/^valid/i.test(d.motStatus)) || (k === 'Tax' && !/^taxed|sorn/i.test(d.taxStatus));
                return `<dt>${esc(k)}</dt><dd${bad ? ' class="qa-bad"' : ''}>${esc(v)}</dd>`;
            }).join('')}</dl>`;
            if (d.markedForExport) body += '<p class="qa-note qa-warn">Marked for export</p>';
        }
        if (state.url) body += `<p class="qa-url">${esc(state.url)}</p>`;
        $('qaBody').innerHTML = body;

        const duplicate = state.status === 'duplicate';
        $('qaEnterLabel').textContent = duplicate ? 'open it' : 'add';
        $('qaConfirm').textContent = duplicate ? 'Open car' : 'Add car';
        $('qaConfirm').disabled = state.status === 'loading' && !state.confirmWhenReady;
    }

    async function open() {
        const primary = $(lastRegSource), other = $(lastRegSource === 'quickRegInput' ? 'registrationInput' : 'quickRegInput');
        const raw = (primary && primary.value.trim()) || (other && other.value.trim()) || '';
        const reg = CarUtils.normalizeRegistration(raw.toUpperCase());
        if (!reg) {
            $('quickRegInput').focus();
            $('quickRegInput').closest('section').scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        $('quickRegInput').value = reg;
        const url = $('quickUrlInput').value.trim();

        const existing = allCars.find(c => c.registration && CarUtils.normalizeRegistration(c.registration) === reg);
        state = { reg, url: url ? (CarUtils.cleanCarListingUrl(url) || url) : '', status: existing ? 'duplicate' : 'loading', existing };
        $('quickModal').hidden = false;
        document.activeElement?.blur();
        render();
        if (existing) return;

        const current = state;
        let result;
        try {
            result = await lookup(reg);
        } catch {
            result = { ok: false, message: 'Could not reach the server' };
        }
        if (state !== current) return; // closed or reopened meanwhile
        if (result.ok) {
            state.status = 'ready';
            state.data = result.data;
        } else {
            state.status = 'error';
            state.message = result.message;
        }
        render();
        if (state.confirmWhenReady) confirm();
    }

    function close() {
        state = null;
        $('quickModal').hidden = true;
    }

    async function confirm() {
        if (!state) return;
        if (state.status === 'loading') {
            // Enter pressed before DVLA answered: add as soon as it does
            state.confirmWhenReady = true;
            render();
            return;
        }
        if (state.status === 'duplicate') {
            const id = state.existing.id;
            close();
            editCar(id);
            return;
        }
        const car = buildCar();
        close();
        try {
            const savedId = await CarStorage.save(car);
            await loadCars();
            const searchInput = $('searchCarsInput');
            displayCars(searchInput ? searchInput.value.trim() : '');
            $('quickRegInput').value = '';
            $('quickUrlInput').value = '';
            CarUtils.scrollToElementWithHighlight(`[data-car-id="${savedId}"]`);
        } catch (error) {
            console.error('Error saving car:', error);
            alert('Error saving car. Please try again.');
        }
    }

    function setup() {
        // Remember which plate box you used last
        ['registrationInput', 'quickRegInput'].forEach(id => {
            const input = $(id);
            if (input) input.addEventListener('input', () => { lastRegSource = id; });
        });

        $('qaCancel').addEventListener('click', close);
        $('qaConfirm').addEventListener('click', confirm);
        $('quickModal').addEventListener('mousedown', e => { if (e.target === e.currentTarget) close(); });

        document.addEventListener('keydown', e => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                open();
                return;
            }
            if (!state) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });
    }

    return { open, close, setup };
})();

document.addEventListener('DOMContentLoaded', QuickAdd.setup);
