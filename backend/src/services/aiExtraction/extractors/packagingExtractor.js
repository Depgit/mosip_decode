const entityExtractor = require('../nlp/entityExtractor');

class PackagingExtractor {
    /**
     * Extract data from packaging images
     */
    async extract(text, ocrData = {}) {
        const entities = entityExtractor.extract(text);

        const packagingData = {
            // Certifications
            iso_codes: this.extractISOCodes(entities, text),
            organic_certified: this.extractOrganicCertification(entities, text),
            certification_logos: this.extractCertificationLogos(text),

            // Product information
            batch_number: this.extractBatchNumber(entities, text),
            manufacturing_date: this.extractManufacturingDate(entities, text),
            expiry_date: this.extractExpiryDate(entities, text),

            // Additional data
            product_name: this.extractProductName(text),
            net_weight: this.extractNetWeight(text),
            ingredients: this.extractIngredients(text),
            storage_instructions: this.extractStorageInstructions(text),

            // Metadata
            raw_entities: entities,
            document_type: 'packaging'
        };

        packagingData.confidence = this.calculateConfidence(packagingData, entities);

        return packagingData;
    }

    /**
     * Extract ISO codes
     */
    extractISOCodes(entities, text) {
        if (entities.iso_codes && entities.iso_codes.length > 0) {
            return entities.iso_codes.map(iso => iso.code);
        }
        return null;
    }

    /**
     * Extract organic certification
     */
    extractOrganicCertification(entities, text) {
        if (entities.organic_status) {
            return entities.organic_status.value;
        }

        // Check for organic certification keywords
        const lowerText = text.toLowerCase();
        const organicKeywords = [
            'usda organic',
            'eu organic',
            'certified organic',
            'organic certified',
            '100% organic'
        ];

        for (const keyword of organicKeywords) {
            if (lowerText.includes(keyword)) {
                return true;
            }
        }

        return null;
    }

    /**
     * Extract certification logos/names
     */
    extractCertificationLogos(text) {
        const certifications = [
            'USDA Organic',
            'EU Organic',
            'Fair Trade',
            'Rainforest Alliance',
            'Non-GMO',
            'Kosher',
            'Halal',
            'Vegan',
            'Gluten Free',
            'BRC',
            'HACCP',
            'GMP'
        ];

        const found = [];
        const lowerText = text.toLowerCase();

        for (const cert of certifications) {
            if (lowerText.includes(cert.toLowerCase())) {
                found.push(cert);
            }
        }

        return found.length > 0 ? found : null;
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
     * Extract manufacturing date
     */
    extractManufacturingDate(entities, text) {
        const patterns = [
            /(?:mfg|manufactured|production)\s*(?:date)?\s*:?\s*([^\n]+)/gi,
            /(?:made|packed)\s*(?:on)?\s*:?\s*([^\n]+)/gi
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return this.parseDate(match[1].trim());
            }
        }

        // Check entities dates
        if (entities.dates && entities.dates.length > 0) {
            const mfgDate = entities.dates.find(d =>
                d.raw && (d.raw.toLowerCase().includes('mfg') ||
                    d.raw.toLowerCase().includes('manufactured'))
            );
            if (mfgDate) {
                return this.parseDate(mfgDate.raw);
            }
        }

        return null;
    }

    /**
     * Extract expiry date
     */
    extractExpiryDate(entities, text) {
        const patterns = [
            /(?:exp|expiry|expiration|best\s*before|use\s*by)\s*(?:date)?\s*:?\s*([^\n]+)/gi
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return this.parseDate(match[1].trim());
            }
        }

        // Check entities dates
        if (entities.dates && entities.dates.length > 0) {
            const expDate = entities.dates.find(d => d.type === 'expiry_date');
            if (expDate) {
                return this.parseDate(expDate.raw);
            }
        }

        return null;
    }

    /**
     * Extract product name
     */
    extractProductName(text) {
        // Product name is usually in the first few lines or near "product"
        const patterns = [
            /product\s*(?:name)?\s*:?\s*([A-Z][^\n]+)/i,
            /^([A-Z][A-Za-z\s]+)(?:\n|$)/m
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const name = match[1].trim();
                if (name.length > 3 && name.length < 100) {
                    return name;
                }
            }
        }

        return null;
    }

    /**
     * Extract net weight
     */
    extractNetWeight(text) {
        const patterns = [
            /net\s*(?:weight|wt\.?|content)\s*:?\s*(\d+\.?\d*\s*(?:kg|g|lb|oz|ml|l))/gi,
            /(\d+\.?\d*\s*(?:kg|g|lb|oz|ml|l))\s*net/gi,
            /weight\s*:?\s*(\d+\.?\d*\s*(?:kg|g|lb|oz|ml|l))/gi
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const weightMatch = match[0].match(/(\d+\.?\d*)\s*(kg|g|lb|oz|ml|l)/i);
                if (weightMatch) {
                    return {
                        value: parseFloat(weightMatch[1]),
                        unit: weightMatch[2]
                    };
                }
            }
        }

        return null;
    }

    /**
     * Extract ingredients list
     */
    extractIngredients(text) {
        const pattern = /ingredients\s*:?\s*([^\n]+(?:\n[^A-Z\n][^\n]+)*)/gi;
        const match = text.match(pattern);

        if (match) {
            const ingredientsText = match[0].replace(/ingredients\s*:?\s*/gi, '').trim();
            // Split by comma or semicolon
            const ingredients = ingredientsText
                .split(/[,;]/)
                .map(i => i.trim())
                .filter(i => i.length > 0 && i.length < 50);

            return ingredients.length > 0 ? ingredients : null;
        }

        return null;
    }

    /**
     * Extract storage instructions
     */
    extractStorageInstructions(text) {
        const pattern = /storage\s*(?:instructions|conditions)?\s*:?\s*([^\n]+)/gi;
        const match = text.match(pattern);

        if (match) {
            return match[0].replace(/storage\s*(?:instructions|conditions)?\s*:?\s*/gi, '').trim();
        }

        return null;
    }

    /**
     * Parse date string
     */
    parseDate(dateStr) {
        try {
            // Remove common prefixes
            const cleaned = dateStr.replace(/^(mfg|exp|expiry|manufactured|best before|use by)\s*:?\s*/gi, '').trim();

            const date = new Date(cleaned);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (error) {
            // Return raw string if parsing fails
        }
        return dateStr;
    }

    /**
     * Calculate confidence
     */
    calculateConfidence(packagingData, entities) {
        let foundFields = 0;
        let totalFields = 0;

        const importantFields = [
            'iso_codes',
            'batch_number',
            'manufacturing_date',
            'expiry_date',
            'product_name',
            'net_weight'
        ];

        for (const field of importantFields) {
            totalFields++;
            if (packagingData[field]) {
                foundFields++;
            }
        }

        const baseConfidence = foundFields / totalFields;

        // Boost confidence if we found certifications
        if (packagingData.iso_codes || packagingData.certification_logos) {
            return Math.min(baseConfidence + 0.1, 0.95);
        }

        return Math.min(baseConfidence, 0.9);
    }
}

module.exports = new PackagingExtractor();
