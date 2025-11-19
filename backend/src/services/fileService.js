const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

class FileService {
  /**
   * Get public file URL
   */
  getFileUrl(filename) {
    return `/uploads/batches/${filename}`;
  }

  /**
   * Process uploaded image (optimize and resize)
   */
  async processImage(filePath, filename) {
    try {
      const ext = path.extname(filename).toLowerCase();
      
      // Only process image files
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        // Optimize image
        await sharp(filePath)
          .resize(1920, 1920, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .toFile(filePath + '.optimized');

        // Replace original with optimized
        await fs.unlink(filePath);
        await fs.rename(filePath + '.optimized', filePath);
      }

      return true;
    } catch (error) {
      console.error('Image processing error:', error);
      return false;
    }
  }

  /**
   * Delete file from disk
   */
  async deleteFile(filename) {
    try {
      const filePath = path.join(__dirname, '../../uploads/batches', filename);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(filename) {
    try {
      const filePath = path.join(__dirname, '../../uploads/batches', filename);
      const stats = await fs.stat(filePath);
      
      return {
        filename,
        size: stats.size,
        url: this.getFileUrl(filename),
        uploadedAt: stats.birthtime
      };
    } catch (error) {
      console.error('File info error:', error);
      return null;
    }
  }
}

module.exports = new FileService();
