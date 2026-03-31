// src/utils/generateFavicons.ts
import React from 'react';
import * as Icons from 'lucide-react';

// Icon to SVG converter
export function iconToSVG(iconComponent: React.ComponentType<any>, size: number = 24, color: string = '#2563eb'): string {
  // Get the SVG path from Lucide icons
  const iconPath = (iconComponent as any)?.render?.()?.props?.children?.[0]?.props?.d || '';

  if (!iconPath) {
    // Fallback to Calendar icon
    const CalendarIcon = Icons.Calendar;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M19 4h-1a1 1 0 0 1-2 0v-1a1 1 0 0 1 2v1a1 1 0 0 1 2H6a1 1 0 0 1-2V7l-1 1H1a1 1 0 0 1-2v2a1 1 0 0 1 2h2a1 1 0 0 1 2v1a1 1 0 0 1 2h2a1 1 0 0 1 2v1a1 1 0 0 1 2h2a1 1 0 0 1 2v1a1 1 0 0 1 2h18a1 1 0 0 1 2V4a1 1 0 0 1 2z"/></svg>`;
  }

  return iconPath || `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M19 4h-1a1 1 0 0 1-2 0v-1a1 1 0 0 1 2v1a1 1 0 0 1 2H6a1 1 0 0 1-2V7l-1 1H1a1 1 0 0 1-2v2a1 1 0 0 1 2h2a1 1 0 0 1 2v1a1 1 0 0 1 2h18a1 1 0 0 1 2V4a1 1 0 0 1 2z"/></svg>`;
}

/**
 * Generate SVG icon from Lucide React icon
 */
export function generateIconSVG(
  iconName: string,
  size: number = 24,
  color: string = '#2563eb'
): string {
  const IconComponent = (Icons as any)[iconName];

  if (IconComponent) {
    return iconToSVG(IconComponent, size, color);
  }

  // Fallback to Calendar icon
  return iconToSVG(Icons.Calendar, size, color);
}

/**
 * Create base64 encoded PNG placeholder for icon
 */
export function generateIconPNG(width: number = 32, height: number = 32): string {
  // Create a simple blue rectangle as placeholder
  return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAABr+gAAAAHElEQVR42mP8/w38CAAAGBgYIIgABJ+5PzLw0/8v0hAAAAgY0hQAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAAf//8v0hQgAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAf//8v0hQgAAAIAAABhAAAf//`;
}

/**
 * Generate favicon link tags
 */
export function generateFaviconLinks(imageUrl?: string): string[] {
  const links = [];

  // SVG favicon (primary)
  links.push(`<link rel="icon" type="image/svg+xml" href="/company-icon.svg" />`);

  // PNG favicon fallbacks
  links.push(`<link rel="icon" type="image/png" sizes="32x32" href="/company-icon-32.png" />`);
  links.push(`<link rel="icon" type="image/png" sizes="16x16" href="/company-icon-16.png" />`);
  links.push(`<link rel="icon" type="image/png" sizes="192x192" href="/company-icon-192.png" />`);
  links.push(`<link rel="icon" type="image/png" sizes="512x512" href="/company-icon-512.png" />`);

  // Apple touch icons
  links.push(`<link rel="apple-touch-icon" href="/company-icon-192.png" />`);
  links.push(`<link rel="apple-touch-icon" sizes="192x192" href="/company-icon-192.png" />`);
  links.push(`<link rel="apple-touch-icon" sizes="512x512" href="/company-icon-512.png" />`);

  // If custom image URL provided, add it
  if (imageUrl) {
    links.push(`<link rel="icon" href="${imageUrl}" />`);
  }

  return links;
}

/**
 * Generate complete favicon HTML
 */
export function generateFaviconHTML(companyName: string, logoConfig?: any): string {
  const svgIcon = generateIconSVG(logoConfig?.iconName || 'Calendar', 32, logoConfig?.backgroundColor || '#2563eb');

  const faviconLinks = generateFaviconLinks(logoConfig?.imagePath);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName} - HR Management System</title>
  ${faviconLinks.join('\n  ')}
  <meta name="description" content="${companyName} Human Resources Management System">
  <meta name="keywords" content="${companyName}, HR, leave management, human resources, employee management">
</head>
<body>
  <!-- Favicon will be dynamically generated -->
</body>
</html>
  `.trim();
}

export default {
  iconToSVG,
  generateIconSVG,
  generateIconPNG,
  generateFaviconLinks,
  generateFaviconHTML
};