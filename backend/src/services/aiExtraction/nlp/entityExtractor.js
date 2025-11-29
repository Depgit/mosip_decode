const natural = require('natural');

class EntityExtractor {
    constructor() {
        this.tokenizer = new natural.WordTokenizer();
    }

    /**
     * Extract all entities from text
     */
    extract(text) {
        if (!text || typeof text !== 'string') {
            return {};
        }

        return {
            moisture_level: this.extractMoistureLevel(text),
            pesticide_content: this.extractPesticideContent(text),
            organic_status: this.extractOrganicStatus(text),
            iso_codes: this.extractISOCodes(text),
            dates: this.extractDates(text),
            lab_name: this.extractLabName(text),
            batch_number: this.extractBatchNumber(text),
            certificate_number: this.extractCertificateNumber(text),
            organizations: this.extractOrganizations(text),
            numbers_with_units: this.extractNumbersWithUnits(text)
        };
    }

    /**
     * Extract moisture level (percentage)
     */
    extractMoistureLevel(text) {
        const patterns = [
            /moisture\s*(?:level|content|%)?\s*:?\s*(\d+\.?\d*)\s*%/gi,
            /moisture\s*(?:level|content)?\s*:?\s*(\d+\.?\d*)/gi,
            /(\d+\.?\d*)\s*%\s*moisture/gi,
            /water\s*content\s*:?\s*(\d+\.?\d*)\s*%/gi
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const numbers = match[0].match(/\d+\.?\d*/);
                if (numbers) {
                    const value = parseFloat(numbers[0]);
                    if (value >= 0 && value <= 100) {
                        return {
                            value: value,
                            unit: '%',
                            confidence: 0.85,
                            source: match[0]
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Extract pesticide content
     */
    extractPesticideContent(text) {
        const patterns = [
            /pesticide\s*(?:residue|content|level)?\s*:?\s*(\d+\.?\d*)\s*(ppm|mg\/kg|ppb)/gi,
            /residue\s*:?\s*(\d+\.?\d*)\s*(ppm|mg\/kg|ppb)/gi,
            /(\d+\.?\d*)\s*(ppm|mg\/kg|ppb)\s*pesticide/gi
        ];

        const results = [];

        for (const pattern of patterns) {
            let match;
            const regex = new RegExp(pattern);
            while ((match = regex.exec(text)) !== null) {
                const value = parseFloat(match[1]);
                const unit = match[2];

                if (value >= 0) {
                    results.push({
                        value: value,
                        unit: unit,
                        confidence: 0.8,
                        source: match[0]
                    });
                }
            }
        }

        return results.length > 0 ? results[0] : null;
    }

    /**
     * Extract organic status
     */
    extractOrganicStatus(text) {
        const lowerText = text.toLowerCase();

        const organicKeywords = [
            'organic certified',
            'certified organic',
            'usda organic',
            'eu organic',
            'organic status: yes',
            'organic: yes',
            'organic certification'
        ];

        const nonOrganicKeywords = [
            'not organic',
            'non-organic',
            'conventional',
            'organic status: no',
            'organic: no'
        ];

        for (const keyword of organicKeywords) {
            if (lowerText.includes(keyword)) {
                return {
                    value: true,
                    confidence: 0.9,
                    source: keyword
                };
            }
        }

        for (const keyword of nonOrganicKeywords) {
            if (lowerText.includes(keyword)) {
                return {
                    value: false,
                    confidence: 0.9,
                    source: keyword
                };
            }
        }

        // Check for organic in general context
        if (lowerText.includes('organic') && !lowerText.includes('non-organic')) {
            return {
                value: true,
                confidence: 0.6,
                source: 'organic mentioned'
            };
        }

        return null;
    }

    /**
     * Extract ISO codes
     */
    extractISOCodes(text) {
        const pattern = /ISO\s*(\d{4,5}(?:[-:]\d{4})?)/gi;
        const matches = text.matchAll(pattern);
        const isoCodes = [];

        for (const match of matches) {
            isoCodes.push({
                code: `ISO ${match[1]}`,
                full_match: match[0],
                confidence: 0.95
            });
        }

        return isoCodes.length > 0 ? isoCodes : null;
    }

    /**
     * Extract dates
     */
    extractDates(text) {
        const datePatterns = [
            /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g,
            /(\d{4})-(\d{1,2})-(\d{1,2})/g,
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/gi
        ];

        const extractedDates = [];

        for (const pattern of datePatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                extractedDates.push({
                    raw: match[0],
                    confidence: 0.7
                });
            }
        }

        // Also check for specific date contexts
        const testDateMatch = text.match(/test\s*date\s*:?\s*([^\n]+)/i);
        if (testDateMatch) {
            extractedDates.push({
                type: 'test_date',
                raw: testDateMatch[1].trim(),
                confidence: 0.85
            });
        }

        const expiryMatch = text.match(/expir(?:y|ation)\s*date\s*:?\s*([^\n]+)/i);
        if (expiryMatch) {
            extractedDates.push({
                type: 'expiry_date',
                raw: expiryMatch[1].trim(),
                confidence: 0.85
            });
        }

        return extractedDates.length > 0 ? extractedDates : null;
    }

    /**
     * Extract lab name
     */
    extractLabName(text) {
        const patterns = [
            /(?:laboratory|lab)\s*:?\s*([A-Z][A-Za-z\s&]+(?:Lab|Laboratory|Testing|Services))/i,
            /tested\s*by\s*:?\s*([A-Z][A-Za-z\s&]+)/i,
            /([A-Z][A-Za-z\s&]+(?:Lab|Laboratory|Testing|Services))/
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return {
                    name: match[1].trim(),
                    confidence: 0.75,
                    source: match[0]
                };
            }
        }

        return null;
    }

    /**
     * Extract batch number
     */
    extractBatchNumber(text) {
        const patterns = [
            /batch\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9\-]+)/i,
            /lot\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9\-]+)/i,
            /batch\s*:?\s*([A-Z0-9\-]{4,})/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return {
                    number: match[1].trim(),
                    confidence: 0.8,
                    source: match[0]
                };
            }
        }

        return null;
    }

    /**
     * Extract certificate number
     */
    extractCertificateNumber(text) {
        const patterns = [
            /certificate\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9\-\/]+)/i,
            /cert\.?\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9\-\/]+)/i,
            /registration\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9\-\/]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return {
                    number: match[1].trim(),
                    confidence: 0.8,
                    source: match[0]
                };
            }
        }

        return null;
    }

    /**
     * Extract organization names
     */
    extractOrganizations(text) {
        // Look for common organization patterns
        const patterns = [
            /([A-Z][A-Za-z\s&]+(?:Laboratory|Lab|Testing|Services|Inc|LLC|Ltd|Corporation|Corp))/g,
            /(?:issued by|tested by|certified by)\s*:?\s*([A-Z][A-Za-z\s&]+)/gi
        ];

        const orgs = [];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const orgName = match[1].trim();
                if (orgName.length > 3 && orgName.length < 100) {
                    orgs.push({
                        name: orgName,
                        confidence: 0.7
                    });
                }
            }
        }

        return orgs.length > 0 ? orgs : null;
    }

    /**
     * Extract all numbers with their units
     */
    extractNumbersWithUnits(text) {
        const pattern = /(\d+\.?\d*)\s*([a-zA-Z%\/]+)/g;
        const matches = text.matchAll(pattern);
        const results = [];

        for (const match of matches) {
            results.push({
                value: parseFloat(match[1]),
                unit: match[2],
                raw: match[0]
            });
        }

        return results.length > 0 ? results : null;
    }

    /**
     * Calculate overall confidence score
     */
    calculateConfidence(entities) {
        const weights = {
            moisture_level: 0.2,
            pesticide_content: 0.2,
            organic_status: 0.15,
            iso_codes: 0.15,
            dates: 0.1,
            lab_name: 0.1,
            batch_number: 0.1
        };

        let totalWeight = 0;
        let weightedConfidence = 0;

        for (const [key, weight] of Object.entries(weights)) {
            if (entities[key]) {
                totalWeight += weight;
                const confidence = Array.isArray(entities[key])
                    ? (entities[key][0]?.confidence || 0.5)
                    : (entities[key].confidence || 0.5);
                weightedConfidence += confidence * weight;
            }
        }

        return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    }
}

module.exports = new EntityExtractor();
