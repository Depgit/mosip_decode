const path = require('path');
const db = require('../../config/database');
const documentClassifier = require('./documentClassifier');
const tesseractOCR = require('./ocr/tesseractOCR');
// const gptVision = require('./ocr/gptVision');
const labReportExtractor = require('./extractors/labReportExtractor');
const packagingExtractor = require('./extractors/packagingExtractor');
const certificateExtractor = require('./extractors/certificateExtractor');

class AIExtractionService {
    constructor() {
        this.extractionMethod = process.env.EXTRACTION_METHOD || 'tesseract'; // tesseract, gpt-vision, hybrid
        this.confidenceThreshold = parseFloat(process.env.EXTRACTION_CONFIDENCE_THRESHOLD) || 0.7;
    }

    /**
     * Main extraction method - processes a file and extracts data
     */
    async processFile(filePath, filename, attachmentId, batchId) {
        try {
            console.log(`🤖 Starting AI extraction for: ${filename}`);

            // Step 1: Quick classify by filename
            const quickClassification = documentClassifier.quickClassify(filename);
            console.log(`📋 Quick classification: ${quickClassification.type} (confidence: ${quickClassification.confidence})`);

            // Step 2: Perform OCR
            const ocrResult = await this.performOCR(filePath, quickClassification.type);
            console.log(`📝 OCR completed with ${ocrResult.text.length} characters extracted`);

            // Step 3: Refine classification with content
            const classification = documentClassifier.classify(filename, ocrResult.text);
            console.log(`📊 Final classification: ${classification.type} (confidence: ${classification.confidence})`);

            // Step 4: Extract structured data based on document type
            const extractedData = await this.extractByType(classification.type, ocrResult.text, ocrResult);
            console.log(`✅ Data extraction completed with confidence: ${extractedData.confidence}`);

            // Step 5: Save to database
            const savedData = await this.saveExtractedData(
                attachmentId,
                batchId,
                classification.type,
                extractedData,
                ocrResult,
                classification.confidence
            );

            console.log(`💾 Saved extraction results to database (ID: ${savedData.id})`);

            return {
                success: true,
                extraction_id: savedData.id,
                document_type: classification.type,
                confidence: extractedData.confidence,
                data: extractedData
            };

        } catch (error) {
            console.error('❌ AI Extraction error:', error);

            // Save error to database
            if (attachmentId) {
                await this.saveExtractionError(attachmentId, batchId, error.message);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Perform OCR based on configured method
     */
    async performOCR(filePath, documentType) {
        // const useGPT = this.extractionMethod === 'gpt-vision' ||
        //     (this.extractionMethod === 'hybrid' && gptVision.isAvailable());

        // if (useGPT && gptVision.isAvailable()) {
        //     try {
        //         console.log('🔮 Using GPT-4 Vision for extraction');
        //         const result = await gptVision.extractStructuredData(filePath, documentType);

        //         // If GPT Vision returns structured data, merge it with text
        //         if (result.structured_data && Object.keys(result.structured_data).length > 0) {
        //             return {
        //                 text: result.text,
        //                 structured_data: result.structured_data,
        //                 confidence: result.confidence,
        //                 method: 'gpt-vision'
        //             };
        //         }

        //         return {
        //             text: result.text,
        //             confidence: result.confidence,
        //             method: 'gpt-vision'
        //         };
        //     } catch (error) {
        //         console.warn('⚠️ GPT Vision failed, falling back to Tesseract:', error.message);
        //         // Fall back to Tesseract
        //     }
        // }

        // Use Tesseract OCR
        console.log('📷 Using Tesseract OCR for extraction');
        const result = await tesseractOCR.extract(filePath);
        return {
            text: result.text,
            confidence: result.confidence,
            method: 'tesseract',
            words: result.words,
            lines: result.lines
        };
    }

    /**
     * Extract data based on document type
     */
    async extractByType(documentType, text, ocrData) {
        switch (documentType) {
            case 'lab_report':
                return await labReportExtractor.extract(text, ocrData);

            case 'packaging':
                return await packagingExtractor.extract(text, ocrData);

            case 'certificate':
                return await certificateExtractor.extract(text, ocrData);

            case 'farming_data':
                // For now, use lab report extractor for farming data
                // You can create a specialized extractor later
                return await labReportExtractor.extract(text, ocrData);

            default:
                // Unknown type - try to extract what we can
                return await labReportExtractor.extract(text, ocrData);
        }
    }

    /**
     * Save extracted data to database
     */
    async saveExtractedData(attachmentId, batchId, documentType, extractedData, ocrResult, classificationConfidence) {
        const finalConfidence = Math.min(
            (extractedData.confidence + classificationConfidence) / 2,
            0.99
        );

        const query = `
      INSERT INTO extracted_data (
        attachment_id,
        batch_id,
        document_type,
        moisture_level,
        pesticide_content,
        pesticide_unit,
        organic_status,
        iso_codes,
        lab_name,
        test_date,
        batch_number,
        certificate_number,
        expiry_date,
        raw_extracted_text,
        extracted_entities,
        confidence_score,
        extraction_method,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

        const values = [
            attachmentId,
            batchId,
            documentType,
            extractedData.moisture_level?.value || null,
            extractedData.pesticide_content?.value || null,
            extractedData.pesticide_content?.unit || null,
            extractedData.organic_status?.value || extractedData.organic_certified || null,
            extractedData.iso_codes || null,
            extractedData.lab_name || null,
            extractedData.test_date || null,
            extractedData.batch_number || null,
            extractedData.certificate_number || null,
            extractedData.expiry_date || null,
            ocrResult.text.substring(0, 10000), // Limit text length
            JSON.stringify({
                ...extractedData,
                ocr_confidence: ocrResult.confidence,
                ocr_method: ocrResult.method
            }),
            finalConfidence,
            ocrResult.method,
            'completed'
        ];

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Save extraction error to database
     */
    async saveExtractionError(attachmentId, batchId, errorMessage) {
        const query = `
      INSERT INTO extracted_data (
        attachment_id,
        batch_id,
        status,
        error_message,
        confidence_score
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

        const values = [
            attachmentId,
            batchId,
            'failed',
            errorMessage,
            0
        ];

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Get extracted data for an attachment
     */
    async getExtractedData(attachmentId) {
        const query = `
      SELECT * FROM extracted_data
      WHERE attachment_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

        const result = await db.query(query, [attachmentId]);
        return result.rows[0] || null;
    }

    /**
     * Get all extracted data for a batch
     */
    async getBatchExtractedData(batchId) {
        const query = `
      SELECT 
        ed.*,
        ba.file_name,
        ba.original_name,
        ba.file_type
      FROM extracted_data ed
      LEFT JOIN batch_attachments ba ON ed.attachment_id = ba.id
      WHERE ed.batch_id = $1
      ORDER BY ed.created_at DESC
    `;

        const result = await db.query(query, [batchId]);
        return result.rows;
    }

    /**
     * Retry extraction for a failed attachment
     */
    async retryExtraction(attachmentId) {
        // Get attachment details
        const attachmentQuery = `
      SELECT * FROM batch_attachments WHERE id = $1
    `;
        const attachmentResult = await db.query(attachmentQuery, [attachmentId]);

        if (attachmentResult.rows.length === 0) {
            throw new Error('Attachment not found');
        }

        const attachment = attachmentResult.rows[0];
        const filePath = path.join(__dirname, '../../../uploads/batches', attachment.file_name);

        return await this.processFile(
            filePath,
            attachment.original_name,
            attachment.id,
            attachment.batch_id
        );
    }

    /**
     * Get extraction statistics
     */
    async getExtractionStats() {
        const query = `
      SELECT 
        document_type,
        COUNT(*) as total,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM extracted_data
      GROUP BY document_type
    `;

        const result = await db.query(query);
        return result.rows;
    }
}

module.exports = new AIExtractionService();
