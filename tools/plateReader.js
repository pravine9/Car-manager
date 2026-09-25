// Plate reader: drop or paste a car photo anywhere on the page to read the UK number plate.
// Locally, server.py reads the photo with Apple Vision, and with PaddleOCR when Vision finds no plate.
// On Vercel, api/ocr.py reads it with PaddleOCR only.
const PlateReader = (() => {
    // Common OCR confusions, by what the position must be
    const toLetter = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G', '4': 'A', '7': 'T' };
    const toDigit = { 'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'Z': '2', 'S': '5', 'B': '8', 'G': '6', 'A': '4', 'T': '7' };

    // Current UK format: 2 letters, 2 digits, 3 letters (e.g. LW16PZF)
    function fixCurrentFormat(s) {
        if (s.length !== 7) return null;
        const pattern = 'LLDDLLL';
        let out = '';
        for (let i = 0; i < 7; i++) {
            const c = s[i];
            if (pattern[i] === 'L') out += /[A-Z]/.test(c) ? c : (toLetter[c] || '?');
            else out += /[0-9]/.test(c) ? c : (toDigit[c] || '?');
        }
        return out.includes('?') ? null : out;
    }

    // needDigit: only accept a match with at least one real digit in the middle (fewer false matches)
    function findCurrent(lines, needDigit) {
        const tokens = lines.flatMap(l => l.split(/\s+/));

        // Candidates: whole lines without spaces, and pairs of neighbouring words ("LW16" + "PZF")
        const candidates = lines.map(l => l.replace(/\s/g, ''));
        for (let i = 0; i < tokens.length - 1; i++) candidates.push(tokens[i] + tokens[i + 1]);
        candidates.push(...tokens);

        for (const c of candidates) {
            // Look at every 7-character window, so extra noise at the ends does not matter
            for (let i = 0; i + 7 <= c.length; i++) {
                const fixed = fixCurrentFormat(c.slice(i, i + 7));
                if (fixed && (!needDigit || /[0-9]/.test(c.slice(i + 2, i + 4)))) return fixed;
            }
        }
        return null;
    }

    // Older formats (prefix A123BCD, suffix ABC123D, dateless)
    function findOlder(lines) {
        const older = /\b([A-Z][0-9]{1,3}[A-Z]{3}|[A-Z]{3}[0-9]{1,3}[A-Z]|[A-Z]{1,3}[0-9]{1,4}|[0-9]{1,4}[A-Z]{1,3})\b/;
        for (const l of lines) {
            const m = l.match(older);
            if (m && m[1].length >= 5) return m[1];
        }
        return null;
    }

    function findPlate(text) {
        const lines = text.toUpperCase().split(/\n+/).map(l => l.replace(/[^A-Z0-9 ]/g, '').trim()).filter(Boolean);
        return findCurrent(lines, true) || findCurrent(lines, false) || findOlder(lines);
    }

    // Big phone photos: make them at most 2000px and a JPEG, so the upload is small and fast
    // (the Vercel function accepts at most 4.5 MB)
    async function shrink(file) {
        const MAX = 2000;
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
            if (scale === 1 && file.size < 3 * 1024 * 1024) return file;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            return await new Promise(resolve => canvas.toBlob(b => resolve(b || file), 'image/jpeg', 0.92));
        } catch {
            return file;
        }
    }

    async function ocr(image, engine) {
        const res = await fetch(`/api/ocr?engine=${engine}`, { method: 'POST', body: image });
        if (!res.ok) throw new Error(`OCR failed (${res.status})`);
        const data = await res.json();
        // engine: what the server really used (on Vercel there is no Apple Vision, only PaddleOCR)
        return { text: data.lines.map(l => l.text).join('\n'), engine: data.engine || engine };
    }

    async function read(file) {
        const image = await shrink(file);
        const first = await ocr(image, 'vision');
        const plate = findPlate(first.text);
        if (plate || first.engine === 'paddle') return { plate, text: first.text, engine: first.engine };
        const second = await ocr(image, 'paddle');
        return { plate: findPlate(second.text), text: `${first.text}\n---\n${second.text}`, engine: 'paddle' };
    }

    function setup() {
        const zone = document.getElementById('plateDropZone');
        const status = document.getElementById('plateStatus');
        const regInput = document.getElementById('registrationInput');
        if (!zone) return;

        function show(text, state) {
            status.textContent = text;
            zone.dataset.state = state;
        }

        async function handleFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            show('Reading…', 'busy');
            try {
                const { plate, text, engine } = await read(file);
                console.debug(`[plate] ${engine}:`, plate, JSON.stringify(text));
                if (plate) {
                    regInput.value = plate;
                    regInput.dispatchEvent(new Event('input'));
                    regInput.focus();
                    show(`Found ${plate}`, 'found');
                } else {
                    show('No plate found', 'none');
                }
            } catch (err) {
                console.error(err);
                show('Plate reader not running', 'none');
            }
        }

        // Drop anywhere on the page
        let dragDepth = 0;
        const hasImage = e => [...(e.dataTransfer?.types || [])].includes('Files');
        document.addEventListener('dragenter', e => { if (hasImage(e)) { dragDepth++; document.body.classList.add('dragging-photo'); } });
        document.addEventListener('dragleave', e => { if (hasImage(e) && --dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging-photo'); } });
        document.addEventListener('dragover', e => { if (hasImage(e)) e.preventDefault(); });
        document.addEventListener('drop', e => {
            dragDepth = 0;
            document.body.classList.remove('dragging-photo');
            const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
            if (!file) return;
            e.preventDefault();
            handleFile(file);
        });

        // Paste a screenshot or copied photo with Cmd+V
        document.addEventListener('paste', e => {
            const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
            if (!item) return;
            e.preventDefault();
            handleFile(item.getAsFile());
        });
    }

    return { setup, read, findPlate };
})();

document.addEventListener('DOMContentLoaded', PlateReader.setup);
