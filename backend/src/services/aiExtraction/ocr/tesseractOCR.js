const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

class TesseractOCR {
    constructor() {
        this.worker = null;
    }

    /**
     * Initialize Tesseract worker
     */
    async initialize() {
        if (!this.worker) {
            this.worker = await Tesseract.createWorker('eng');
        }
        return this.worker;
    }

    /**
     * Preprocess image for better OCR accuracy
     */
    async preprocessImage(imagePath) {
        try {
            const processedPath = imagePath + '.processed.png';

            await sharp(imagePath)
                .greyscale()
                .normalize()
                .sharpen()
                .threshold(128)
                .toFile(processedPath);

            return processedPath;
        } catch (error) {
            console.error('Image preprocessing error:', error);
            return imagePath; // Return original if preprocessing fails
        }
    }

    /**
     * Extract text from image using Tesseract OCR
     */
    async extractText(imagePath) {
        try {
            await this.initialize();

            // Preprocess image for better accuracy
            const processedPath = await this.preprocessImage(imagePath);

            // Perform OCR
            const { data } = await this.worker.recognize(processedPath);

            // Clean up processed image
            if (processedPath !== imagePath) {
                try {
                    await fs.unlink(processedPath);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }

            return {
                text: data.text,
                confidence: data.confidence,
                words: data.words ? data.words.map(w => ({
                    text: w.text,
                    confidence: w.confidence,
                    bbox: w.bbox
                })) : [],
                lines: data.lines ? data.lines.map(l => ({
                    text: l.text,
                    confidence: l.confidence,
                    bbox: l.bbox
                })) : []
            };
        } catch (error) {
            console.error('Tesseract OCR error:', error);
            throw new Error(`OCR extraction failed: ${error.message}`);
        }
    }

    /**
     * Extract text from PDF (first convert to images)
     */
    async extractFromPDF(pdfPath) {
        // For now, we'll use pdf-parse for text extraction
        // In production, you might want to convert PDF to images first
        const pdfParse = require('pdf-parse');

        try {
            const dataBuffer = await fs.readFile(pdfPath);
            const data = await pdfParse(dataBuffer);

            return {
                text: data.text,
                confidence: 85, // Estimated confidence for PDF text extraction
                pages: data.numpages
            };
        } catch (error) {
            console.error('PDF extraction error:', error);
            throw new Error(`PDF extraction failed: ${error.message}`);
        }
    }

    /**
     * Extract text from file (auto-detect type)
     */
    async extract(filePath) {
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.pdf') {
            return await this.extractFromPDF(filePath);
        } else if (['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp'].includes(ext)) {
            return await this.extractText(filePath);
        } else {
            throw new Error(`Unsupported file type: ${ext}`);
        }
    }

    /**
     * Terminate worker
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}

module.exports = new TesseractOCR();
