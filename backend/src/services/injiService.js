const axios = require('axios');
const QRCode = require('qrcode');

class InjiService {
  constructor() {
    this.certifyUrl = process.env.INJI_CERTIFY_API_URL;
    this.verifyUrl = process.env.INJI_VERIFY_API_URL;
    this.issuerDid = process.env.INJI_ISSUER_DID;
    this.apiKey = process.env.INJI_API_KEY;
  }

  /**
   * Issue a Verifiable Credential
   */
  async issueCredential(batch, inspection) {
    try {
      console.log('Issuing VC for batch:', batch.id);

      const credentialSubject = {
        batchId: batch.id,
        productType: batch.product_type,
        quantity: batch.quantity,
        unit: batch.unit,
        destination: batch.destination,
        qualityMetrics: {
          moistureLevel: inspection.moisture_level,
          pesticideContent: inspection.pesticide_content,
          organicStatus: inspection.organic_status,
          qualityRating: inspection.quality_rating
        },
        inspectionDate: inspection.inspected_at
      };

      // Prepare VC document
      const vc = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        "type": ["VerifiableCredential", "DigitalProductPassport"],
        "issuer": this.issuerDid,
        "issuanceDate": new Date().toISOString(),
        "expirationDate": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        "credentialSubject": credentialSubject
      };

      // In production, call Inji Certify API to sign this
      // For now, simulate the response
      console.log('✅ VC created (simulated - integrate real Inji in production)');

      return {
        success: true,
        vc: vc
      };

    } catch (error) {
      console.error('VC issuance error:', error.message);
      throw new Error('Failed to issue credential');
    }
  }

  /**
   * Generate QR Code
   */
  async generateQRCode(vc) {
    try {
      const qrData = JSON.stringify(vc);
      const qrCode = await QRCode.toDataURL(qrData);

      return {
        success: true,
        qrImage: qrCode
      };

    } catch (error) {
      console.error('QR generation error:', error.message);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify Verifiable Credential
   */
  async verifyCredential(vc) {
    try {
      console.log('Verifying VC...');

      // Check basic validity
      const isValid = vc && vc.issuer && vc.credentialSubject;

      return {
        success: true,
        isValid: isValid,
        issuer: vc.issuer,
        issuanceDate: vc.issuanceDate,
        expirationDate: vc.expirationDate,
        credentialSubject: vc.credentialSubject,
        verificationTimestamp: new Date()
      };

    } catch (error) {
      console.error('VC verification error:', error.message);
      return {
        success: false,
        isValid: false,
        message: 'Failed to verify credential'
      };
    }
  }
}

module.exports = new InjiService();
