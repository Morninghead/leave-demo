/**
 * Helper function to get display name based on current language
 * with fallback support
 */
export const getDisplayName = (
  firstNameTh: string | null | undefined,
  lastNameTh: string | null | undefined,
  firstNameEn: string | null | undefined,
  lastNameEn: string | null | undefined,
  language: 'th' | 'en' = 'th'
): string => {
  // Clean up values
  const fth = firstNameTh?.trim();
  const lth = lastNameTh?.trim();
  const fen = firstNameEn?.trim();
  const len = lastNameEn?.trim();

  // ภาษาไทย
  if (language === 'th') {
    // มีชื่อไทยครบ
    if (fth && lth) {
      return `${fth} ${lth}`;
    }
    // มีแค่ชื่อไทย (ไม่มีนามสกุล)
    if (fth) {
      return fth;
    }
    // Fallback: ใช้ชื่ออังกฤษ
    if (fen && len) {
      return `${fen} ${len}`;
    }
    if (fen) {
      return fen;
    }
    return 'ผู้ใช้งาน';
  }
  
  // ภาษาอังกฤษ
  else {
    // มีชื่ออังกฤษครบ
    if (fen && len) {
      return `${fen} ${len}`;
    }
    // มีแค่ชื่ออังกฤษ (ไม่มีนามสกุล)
    if (fen) {
      return fen;
    }
    // Fallback: ใช้ชื่อไทย
    if (fth && lth) {
      return `${fth} ${lth}`;
    }
    if (fth) {
      return fth;
    }
    return 'User';
  }
};

/**
 * Get short display name (first name only)
 */
export const getShortName = (
  firstNameTh: string | null | undefined,
  firstNameEn: string | null | undefined,
  language: 'th' | 'en' = 'th'
): string => {
  const fth = firstNameTh?.trim();
  const fen = firstNameEn?.trim();

  if (language === 'th') {
    return fth || fen || 'ผู้ใช้';
  } else {
    return fen || fth || 'User';
  }
};
