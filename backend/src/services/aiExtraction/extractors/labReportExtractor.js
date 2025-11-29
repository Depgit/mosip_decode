const entityExtractor = require('../nlp/entityExtractor');

class LabReportExtractor {
    /**
     * Extract data from lab report
     */
    async extract(text, ocrData = {}) {
        const entities = entityExtractor.extract(text);

        // Extract lab-specific data
        const labData = {
            // Core quality metrics
            moisture_level: this.extractMoistureLevel(entities, text),
            pesticide_content: this.extractPesticideContent(entities, text),
            organic_status: this.extractOrganicStatus(entities, text),

            // Lab metadata
            lab_name: this.extractLabName(entities, text),
            test_date: this.extractTestDate(entities, text),
            batch_number: this.extractBatchNumber(entities, text),

            // Additional parameters
            heavy_metals: this.extractHeavyMetals(text),
            microbial_count: this.extractMicrobialCount(text),
            ph_level: this.extractPHLevel(text),
            aflatoxin: this.extractAflatoxin(text),

            // Metadata
            raw_entities: entities,
            document_type: 'lab_report'
        };

        // Calculate confidence
        labData.confidence = this.calculateConfidence(labData, entities);

        return labData;
    }

    /**
     * Extract moisture level
     */
    extractMoistureLevel(entities, text) {
        if (entities.moisture_level) {
            return {
                value: entities.moisture_level.value,
                unit: entities.moisture_level.unit || '%',
                confidence: entities.moisture_level.confidence
            };
        }
        return null;
    }

    /**
     * Extract pesticide content
     */
    extractPesticideContent(entities, text) {
        if (entities.pesticide_content) {
            return {
                value: entities.pesticide_content.value,
                unit: entities.pesticide_content.unit || 'ppm',
                confidence: entities.pesticide_content.confidence
            };
        }

        // Try to extract from numbers with units
        if (entities.numbers_with_units) {
            for (const num of entities.numbers_with_units) {
                if (['ppm', 'ppb', 'mg/kg'].includes(num.unit.toLowerCase())) {
                    return {
                        value: num.value,
                        unit: num.unit,
                        confidence: 0.6
                    };
                }
            }
        }

        return null;
    }

    /**
     * Extract organic status
     */
    extractOrganicStatus(entities, text) {
        if (entities.organic_status) {
            return {
                value: entities.organic_status.value,
                confidence: entities.organic_status.confidence
            };
        }
        return null;
    }

    /**
     * Extract lab name
     */
    extractLabName(entities, text) {
        if (entities.lab_name) {
            return entities.lab_name.name;
        }

        // Try to extract from organizations
        if (entities.organizations && entities.organizations.length > 0) {
            return entities.organizations[0].name;
        }

        return null;
    }

    /**
     * Extract test date
     */
    extractTestDate(entities, text) {
        if (entities.dates && entities.dates.length > 0) {
            // Look for test date specifically
            const testDate = entities.dates.find(d => d.type === 'test_date');
            if (testDate) {
                return this.parseDate(testDate.raw);
            }
            // Otherwise return first date
            return this.parseDate(entities.dates[0].raw);
        }
        return null;
    }

    /**
     * Extract batch number
     */
    extractBatchNumber(entities, text) {
        if (entities.batch_number) {
            return entities.batch_number.number;
        }
        return null;
    }

    /**
     * Extract heavy metals
     */
    extractHeavyMetals(text) {
        const metals = ['lead', 'mercury', 'cadmium', 'arsenic', 'chromium'];
        const results = {};

        for (const metal of metals) {
            const pattern = new RegExp(`${metal}\\s*:?\\s*(\\d+\\.?\\d*)\\s*(ppm|ppb|mg\\/kg)`, 'gi');
            const match = text.match(pattern);

            if (match) {
                const valueMatch = match[0].match(/(\d+\.?\d*)\s*(ppm|ppb|mg\/kg)/i);
                if (valueMatch) {
                    results[metal] = {
                        value: parseFloat(valueMatch[1]),
                        unit: valueMatch[2]
                    };
                }
            }
        }

        return Object.keys(results).length > 0 ? results : null;
    }

    /**
     * Extract microbial count
     */
    extractMicrobialCount(text) {
        const patterns = [
            /(?:total\s*)?(?:microbial|bacterial)\s*count\s*:?\s*(\d+\.?\d*(?:e[+-]?\d+)?)\s*(cfu\/g|cfu\/ml)?/gi,
            /(?:total\s*)?plate\s*count\s*:?\s*(\d+\.?\d*(?:e[+-]?\d+)?)\s*(cfu\/g|cfu\/ml)?/gi
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const valueMatch = match[0].match(/(\d+\.?\d*(?:e[+-]?\d+)?)/i);
                if (valueMatch) {
                    return {
                        value: parseFloat(valueMatch[1]),
                        unit: 'cfu/g'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Extract pH level
     */
    extractPHLevel(text) {
        const pattern = /ph\s*(?:level|value)?\s*:?\s*(\d+\.?\d*)/gi;
        const match = text.match(pattern);

        if (match) {
            const valueMatch = match[0].match(/(\d+\.?\d*)/);
            if (valueMatch) {
                const value = parseFloat(valueMatch[1]);
                if (value >= 0 && value <= 14) {
                    return {
                        value: value,
                        unit: 'pH'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Extract aflatoxin levels
     */
    extractAflatoxin(text) {
        const pattern = /aflatoxin\s*(?:b1|total)?\s*:?\s*(\d+\.?\d*)\s*(ppb|μg\/kg|ug\/kg)/gi;
        const match = text.match(pattern);

        if (match) {
            const valueMatch = match[0].match(/(\d+\.?\d*)\s*(ppb|μg\/kg|ug\/kg)/i);
            if (valueMatch) {
                return {
                    value: parseFloat(valueMatch[1]),
                    unit: valueMatch[2]
                };
            }
        }

        return null;
    }

    /**
     * Parse date string to ISO format
     */
    parseDate(dateStr) {
        if (!dateStr) return null;

        try {
            // Extract date patterns from the string
            const datePatterns = [
                /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/,  // YYYY-MM-DD or YYYY.MM.DD
                /(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/,  // DD-MM-YYYY or MM/DD/YYYY
                /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i
            ];

            for (const pattern of datePatterns) {
                const match = dateStr.match(pattern);
                if (match) {
                    // Use the matched date part only
                    const datePart = match[0];
                    const date = new Date(datePart);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString().split('T')[0];
                    }
                }
            }

            // If no pattern matched, try direct parsing
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (error) {
            console.warn('Date parsing failed for:', dateStr);
        }

        return null; // Return null instead of invalid string
    }

    /**
     * Calculate extraction confidence
     */
    calculateConfidence(labData, entities) {
        let foundFields = 0;
        let totalConfidence = 0;
        const importantFields = [
            'moisture_level',
            'pesticide_content',
            'organic_status',
            'lab_name',
            'test_date'
        ];

        for (const field of importantFields) {
            if (labData[field]) {
                foundFields++;
                if (typeof labData[field] === 'object' && labData[field].confidence) {
                    totalConfidence += labData[field].confidence;
                } else {
                    totalConfidence += 0.7; // Default confidence
                }
            }
        }

        if (foundFields === 0) return 0.3;

        return Math.min(totalConfidence / foundFields, 0.95);
    }
}

module.exports = new LabReportExtractor();
