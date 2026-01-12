import { readdirSync, createReadStream } from 'fs';
import { join } from 'path';
import { request } from 'undici';
import { FormData } from 'undici';

const PDF_DIR = '../../data/pdf/real_dataset';
const API_URL = 'http://localhost:3001/ingest';

async function ingestAll() {
    const files = readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
    console.log(`Found ${files.length} PDF files to ingest...`);

    for (const file of files) {
        console.log(`Ingesting ${file}...`);
        try {
            const form = new FormData();
            // Read file buffer
            const filePath = join(PDF_DIR, file);

            // Undici's FormData is web-standard compliant
            // We need to pass a Blob-like object or text. For Node streams:
            const { Blob } = await import('buffer');
            const fs = await import('fs/promises');
            const fileBuffer = await fs.readFile(filePath);

            const blob = new Blob([fileBuffer], { type: 'application/pdf' });
            form.append('file', blob, file);

            const { statusCode, body } = await request(API_URL, {
                method: 'POST',
                body: form,
            });

            const res = await body.json();
            if (statusCode === 200 && res.ok) {
                console.log(`✅ Success: ${file} (${res.chunks} chunks)`);
            } else {
                console.error(`❌ Failed ${file}: ${res.message || statusCode}`);
            }
        } catch (err) {
            console.error(`❌ Error ingesting ${file}:`, err.message);
        }
    }
}

ingestAll();
