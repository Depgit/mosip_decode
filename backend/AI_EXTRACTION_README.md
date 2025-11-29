# AI Document Extraction - README

## Overview

The AI Document Extraction system automatically extracts agricultural quality data from farmer-uploaded documents including:
- Laboratory test reports
- Packaging images
- Certificates and compliance documents
- Farming data sheets

## Extracted Data

The system extracts the following information:
- **Moisture level** (percentage)
- **Pesticide content** (ppm or mg/kg)
- **Organic status** (certified/non-certified)
- **ISO codes** (ISO 22000, ISO 9001, etc.)
- **Lab information** (lab name, test date)
- **Batch numbers**
- **Certificate details** (number, dates, issuer)
- **Additional parameters** (heavy metals, pH, microbial count, etc.)

## How It Works

1. **Document Classification**: Automatically identifies document type (lab report, packaging, certificate)
2. **OCR Processing**: Extracts text using Tesseract OCR or GPT-4 Vision
3. **Entity Extraction**: Uses NLP to identify and extract specific data points
4. **Data Storage**: Saves extracted data to the `extracted_data` table
5. **API Access**: Provides endpoints to retrieve and manage extracted data

## Configuration

Add these environment variables to your `.env` file:

```bash
# OpenAI API Key (optional - for GPT-4 Vision)
OPENAI_API_KEY=your_api_key_here

# Extraction method: tesseract, gpt-vision, or hybrid
EXTRACTION_METHOD=hybrid

# Confidence threshold (0.0 - 1.0)
EXTRACTION_CONFIDENCE_THRESHOLD=0.7
```

## API Endpoints

### Get Extracted Data for Attachment
```
GET /api/extraction/:attachmentId
```

### Get All Extracted Data for Batch
```
GET /api/extraction/batch/:batchId
```

### Retry Failed Extraction
```
POST /api/extraction/retry/:attachmentId
```

### Manual Trigger Extraction
```
POST /api/extraction/process/:attachmentId
```

### Get Extraction Statistics
```
GET /api/extraction/stats/overview
```

## Usage

### Automatic Extraction
When a farmer uploads documents via the batch creation API, extraction happens automatically in the background:

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Authorization: Bearer $TOKEN" \
  -F "productType=Rice" \
  -F "quantity=1000" \
  -F "files=@lab_report.pdf"
```

### Retrieve Extracted Data
```bash
curl http://localhost:3000/api/extraction/batch/123 \
  -H "Authorization: Bearer $TOKEN"
```

## Database Schema

The `extracted_data` table stores all extraction results:

```sql
CREATE TABLE extracted_data (
  id SERIAL PRIMARY KEY,
  attachment_id INTEGER REFERENCES batch_attachments(id),
  batch_id INTEGER REFERENCES batches(id),
  document_type VARCHAR(50),
  moisture_level DECIMAL(5,2),
  pesticide_content DECIMAL(8,3),
  pesticide_unit VARCHAR(20),
  organic_status BOOLEAN,
  iso_codes TEXT[],
  lab_name VARCHAR(255),
  test_date DATE,
  batch_number VARCHAR(100),
  certificate_number VARCHAR(100),
  expiry_date DATE,
  raw_extracted_text TEXT,
  extracted_entities JSONB,
  confidence_score DECIMAL(3,2),
  extraction_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Extraction Methods

### Tesseract OCR (Free)
- Open-source OCR engine
- Good for clear, printed text
- No API costs
- Works offline

### GPT-4 Vision (Paid)
- Advanced AI vision model
- Better for complex layouts, handwritten text
- Understands context and structure
- Requires OpenAI API key
- Pay per API call

### Hybrid (Recommended)
- Uses GPT-4 Vision if available
- Falls back to Tesseract if not configured
- Best accuracy with cost control

## Confidence Scores

Each extraction includes a confidence score (0.0 - 1.0):
- **0.8 - 1.0**: High confidence, data is likely accurate
- **0.6 - 0.8**: Medium confidence, may need review
- **0.0 - 0.6**: Low confidence, manual verification recommended

## Error Handling

If extraction fails:
1. Error is logged in the `extracted_data` table with `status='failed'`
2. Error message is stored for debugging
3. You can retry extraction using the retry endpoint

## Performance

- Extraction runs asynchronously (doesn't block batch creation)
- Typical processing time: 2-10 seconds per document
- Results are cached in the database

## Dependencies

- `tesseract.js`: OCR processing
- `openai`: GPT-4 Vision API
- `pdf-parse`: PDF text extraction
- `natural`: NLP processing
- `compromise`: Lightweight NLP
- `sharp`: Image preprocessing

## Troubleshooting

### Extraction not working
1. Check if dependencies are installed: `npm install`
2. Verify file permissions on uploads directory
3. Check logs for error messages

### Low confidence scores
1. Ensure documents are clear and readable
2. Try using GPT-4 Vision for better accuracy
3. Consider manual data entry for critical documents

### GPT-4 Vision not working
1. Verify `OPENAI_API_KEY` is set in `.env`
2. Check API key has sufficient credits
3. System will fall back to Tesseract automatically

## Future Enhancements

- Support for more document types
- Multi-language OCR
- Training custom models for specific document formats
- Batch processing optimization
- Real-time extraction progress updates
