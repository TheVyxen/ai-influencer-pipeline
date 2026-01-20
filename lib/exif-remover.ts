/**
 * Utilitaire pour supprimer les métadonnées EXIF des images
 * Utilise Sharp pour re-encoder les images sans métadonnées
 */

import sharp from 'sharp'

/**
 * Supprime les métadonnées EXIF d'une image et la sauvegarde
 * @param inputPath - Chemin vers l'image source
 * @param outputPath - Chemin de destination (peut être identique à inputPath)
 */
export async function removeExif(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .rotate() // Applique l'orientation EXIF puis supprime les métadonnées
    .toFile(outputPath)
}

/**
 * Supprime les métadonnées EXIF d'un Buffer et retourne un nouveau Buffer propre
 * @param imageBuffer - Buffer de l'image avec potentiellement des métadonnées
 * @returns Buffer de l'image sans métadonnées
 */
export async function removeExifFromBuffer(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate() // Applique l'orientation EXIF puis supprime les métadonnées
    .toBuffer()
}

/**
 * Vérifie si une image contient des métadonnées EXIF/IPTC/XMP
 * @param imagePath - Chemin vers l'image à vérifier
 * @returns true si l'image contient des métadonnées, false sinon
 */
export async function hasExif(imagePath: string): Promise<boolean> {
  const metadata = await sharp(imagePath).metadata()
  return !!(metadata.exif || metadata.iptc || metadata.xmp)
}

/**
 * Vérifie si un Buffer d'image contient des métadonnées
 * @param imageBuffer - Buffer de l'image à vérifier
 * @returns true si l'image contient des métadonnées, false sinon
 */
export async function hasExifFromBuffer(imageBuffer: Buffer): Promise<boolean> {
  const metadata = await sharp(imageBuffer).metadata()
  return !!(metadata.exif || metadata.iptc || metadata.xmp)
}
