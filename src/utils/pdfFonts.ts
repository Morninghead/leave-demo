/**
 * PDF Thai Font Support
 *
 * Adds Sarabun font to jsPDF for proper Thai text rendering
 * Font: Sarabun (Google Fonts, SIL Open Font License)
 */

import { jsPDF } from 'jspdf';
import SarabunRegular from '../fonts/Sarabun-Regular.js';
import SarabunBold from '../fonts/Sarabun-Bold.js';

/**
 * Add Thai font support to jsPDF instance
 * Uses Sarabun font for Thai text rendering
 *
 * NOTE: This must be called for EACH new jsPDF instance.
 * Fonts are instance-specific, not global.
 */
export function addThaiFont(doc: jsPDF) {
  try {
    // Add Sarabun Regular font to this document instance
    doc.addFileToVFS('Sarabun-Regular.ttf', SarabunRegular);
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');

    // Add Sarabun Bold font to this document instance
    doc.addFileToVFS('Sarabun-Bold.ttf', SarabunBold);
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
  } catch (e) {
    console.error('Failed to add Thai font to PDF:', e);
    // Fallback to helvetica if font loading fails
  }
}

/**
 * Set Thai font for rendering
 * This is a helper function to ensure consistent Thai text rendering
 */
export function setThaiFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal') {
  try {
    doc.setFont('Sarabun', style);
  } catch (e) {
    // Fallback to helvetica if Sarabun is not available
    console.warn('Sarabun font not available, falling back to helvetica');
    doc.setFont('helvetica', style);
  }
}

/**
 * Helper to add text with automatic Thai font handling
 */
export function addThaiText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: {
    align?: 'left' | 'center' | 'right';
    maxWidth?: number;
    style?: 'normal' | 'bold';
  }
) {
  setThaiFont(doc, options?.style);

  if (options?.align || options?.maxWidth) {
    const textOptions: any = {};
    if (options.align) textOptions.align = options.align;
    if (options.maxWidth) textOptions.maxWidth = options.maxWidth;
    doc.text(text, x, y, textOptions);
  } else {
    doc.text(text, x, y);
  }
}
