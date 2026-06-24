/**
 * Maps Rebrickable Color IDs to BrickLink Color IDs.
 * Reference: https://rebrickable.com/colors/
 */
export const REBRICKABLE_TO_BRICKLINK_COLOR: Record<number, number> = {
  // Solid Colors
  0: 11,     // Black -> Black
  1: 7,      // Blue -> Blue
  2: 6,      // Green -> Green
  3: 39,     // Dark Turquoise -> Dark Turquoise
  4: 5,      // Red -> Red
  5: 47,     // Dark Pink -> Dark Pink
  6: 8,      // Brown -> Brown
  7: 9,      // Light Gray -> Light Gray (Old)
  8: 10,     // Dark Gray -> Dark Gray (Old)
  9: 9,      // Light Gray -> Light Gray (Old)
  10: 10,    // Dark Gray -> Dark Gray (Old)
  11: 62,    // Light Blue -> Light Blue
  12: 38,    // Light Green -> Light Green
  13: 23,    // Pink -> Pink
  14: 3,     // Yellow -> Yellow
  15: 1,     // White -> White
  18: 15,    // Light Turquoise / Aqua -> Aqua
  19: 16,    // Sand Blue -> Sand Blue
  24: 24,    // Purple -> Purple
  25: 4,     // Orange -> Orange
  26: 141,   // Magenta -> Magenta
  27: 34,    // Lime -> Lime
  28: 2,     // Tan -> Tan
  30: 157,   // Medium Lavender -> Medium Lavender
  31: 154,   // Dark Lavender -> Dark Lavender
  71: 86,    // Light Bluish Gray -> Light Bluish Gray
  72: 85,    // Dark Bluish Gray -> Dark Bluish Gray
  78: 84,    // Light Nougat -> Light Nougat
  84: 150,   // Medium Nougat -> Medium Nougat
  89: 89,    // Royal Blue -> Royal Blue
  110: 110,  // Bright Light Orange -> Bright Light Orange
  150: 150,  // Medium Nougat -> Medium Nougat
  151: 227,  // Dark Azure -> Dark Azure
  272: 63,   // Dark Blue -> Dark Blue
  288: 120,  // Dark Green -> Dark Green
  297: 115,  // Pearl Gold -> Pearl Gold
  320: 59,   // Dark Red -> Dark Red
  322: 156,  // Medium Azure -> Medium Azure
  326: 155,  // Olive Green -> Olive Green
  335: 18,   // Sand Red -> Sand Red
  378: 116,  // Sand Green -> Sand Green
  484: 68,   // Dark Orange -> Dark Orange
  1050: 103, // Coral -> Coral
  1062: 220, // Vibrant Yellow -> Neon Yellow

  // Trans Colors
  33: 14,    // Trans-Dark Blue -> Trans-Dark Blue
  34: 20,    // Trans-Green -> Trans-Green (BL 20)
  35: 107,   // Trans-Bright Green -> Trans-Bright Green
  36: 19,    // Trans-Red -> Trans-Red (Rebrickable 36, BL 19)
  40: 13,    // Trans-Brown -> Trans-Black (BL 13)
  41: 15,    // Trans-Light Blue -> Trans-Light Blue (BL 15)
  42: 16,    // Trans-Neon Green -> Trans-Neon Green (BL 16)
  46: 17,    // Trans-Yellow -> Trans-Yellow (BL 17)
  47: 12,    // Trans-Clear -> Trans-Clear (BL 12)
  52: 51,    // Trans-Purple -> Trans-Purple (BL 51)
  54: 121,   // Trans-Neon Yellow -> Trans-Neon Yellow
  57: 18,    // Trans-Neon Orange -> Trans-Neon Orange (BL 18)
  143: 113,  // Trans-Medium Blue -> Trans-Medium Blue
  182: 18,   // Trans-Orange -> Trans-Orange
  230: 74,   // Trans-Pink -> Trans-Dark Pink (BL 74)
  236: 76,   // Trans-Light Purple -> Trans-Medium Purple (BL 76)
  1095: 13,  // Trans-Black -> Trans-Black (BL 13)

  // Pearl / Metallic / Chrome
  61: 77,    // Chrome Blue -> Chrome Blue (BL 77)
  134: 61,   // Copper -> Pearl Copper
  135: 66,   // Pearl Light Gray -> Pearl Light Gray (BL 66)
  148: 95,   // Pearl Dark Gray -> Flat Silver (BL 95)
  179: 95,   // Flat Silver -> Flat Silver
  334: 80,   // Chrome Gold -> Chrome Gold (BL 80)
  383: 21,   // Chrome Silver -> Chrome Silver (BL 21)
  1063: 61,  // Pearl Copper -> Pearl Copper (BL 61)
  1135: 85,  // Metal -> Flat Silver (BL 85)
}

/**
 * Maps a Rebrickable color ID to a BrickLink color ID.
 * Falls back to the original color ID if no mapping is found.
 */
export function mapRebrickableToBrickLinkColor(rbColorId: number): number {
  if (rbColorId in REBRICKABLE_TO_BRICKLINK_COLOR) {
    return REBRICKABLE_TO_BRICKLINK_COLOR[rbColorId]
  }
  return rbColorId
}
