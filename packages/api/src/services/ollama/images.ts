import sharp from 'sharp';

/**
 * Optimize image for API compatibility: resize to 800x800 max and compress
 */
export async function optimizeImage(base64Data: string, format: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const image = sharp(buffer);
    const metadata = await image.metadata();

    console.log(`🔄 Optimizing image: ${metadata.width}x${metadata.height}, format=${format}`);

    // Resize to max 800x800 for better API compatibility
    const maxDimension = 800;
    let resizedImage = image;

    if (metadata.width && metadata.height) {
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        resizedImage = image.resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        });
        console.log(`   📐 Resizing to max ${maxDimension}px`);
      }
    }

    // Convert to JPEG with quality 85 for better compression (unless it's PNG with transparency)
    const hasAlpha = metadata.hasAlpha;
    let optimizedBuffer: Buffer;

    if (hasAlpha) {
      // Keep PNG for images with transparency but optimize
      optimizedBuffer = await resizedImage
        .png({
          compressionLevel: 9,
          quality: 85,
        })
        .toBuffer();
      console.log('   💾 Optimized as PNG (transparency detected)');
    } else {
      // Convert to JPEG for better compression
      optimizedBuffer = await resizedImage
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();
      console.log('   💾 Converted to JPEG for better compression');
    }

    const optimizedBase64 = optimizedBuffer.toString('base64');
    const originalSizeMB = (base64Data.length / (1024 * 1024)).toFixed(2);
    const newSizeMB = (optimizedBase64.length / (1024 * 1024)).toFixed(2);

    console.log(`   ✅ Optimized: ${originalSizeMB}MB -> ${newSizeMB}MB`);

    return optimizedBase64;
  } catch (error) {
    console.error('⚠️  Image optimization failed:', error);
    throw new Error('Failed to process image. Please try a different image.');
  }
}
