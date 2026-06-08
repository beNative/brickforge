export interface TechnicGroup {
  id: number
  name: string
  sort_order: number
}

export const TECHNIC_GROUPS: TechnicGroup[] = [
  { id: 1, name: 'Pins', sort_order: 1 },
  { id: 2, name: 'Axles', sort_order: 2 },
  { id: 3, name: 'Bushes', sort_order: 3 },
  { id: 4, name: 'Connectors', sort_order: 4 },
  { id: 5, name: 'Liftarms', sort_order: 5 },
  { id: 6, name: 'Frames', sort_order: 6 },
  { id: 7, name: 'Panels', sort_order: 7 },
  { id: 8, name: 'Gears', sort_order: 8 },
  { id: 9, name: 'Differentials', sort_order: 9 },
  { id: 10, name: 'Steering and suspension parts', sort_order: 10 },
  { id: 11, name: 'Wheels and tyres', sort_order: 11 },
  { id: 12, name: 'Pneumatics', sort_order: 12 },
  { id: 13, name: 'Linear actuators', sort_order: 13 },
  { id: 14, name: 'Electronics', sort_order: 14 },
  { id: 15, name: 'Hoses, strings and flex parts', sort_order: 15 },
  { id: 16, name: 'Stickers', sort_order: 16 },
  { id: 17, name: 'Other', sort_order: 17 }
]

/**
 * Maps a Rebrickable category name (or part name) to a Technic Group ID.
 */
export function getTechnicGroupId(categoryName: string, partName: string): number {
  const cat = categoryName.toLowerCase()
  const name = partName.toLowerCase()

  // Match stickers
  if (cat.includes('sticker') || name.includes('sticker') || cat.includes('decal')) {
    return 16
  }
  // Match pins
  if (cat.includes('pins') || cat.includes('pin ') || name.includes('technic pin')) {
    return 1
  }
  // Match axles
  if (cat.includes('axles') || name.startsWith('technic axle') || name.includes('axle ')) {
    return 2
  }
  // Match bushes
  if (cat.includes('bush') || name.includes('bush ') || name.endsWith('bush')) {
    return 3
  }
  // Match liftarms and beams
  if (cat.includes('liftarm') || name.includes('liftarm') || cat.includes('beams') || name.includes('technic beam')) {
    // Frames are a sub-set of liftarms/beams. Let's see:
    if (name.includes('frame') || name.includes('rectangular') || name.includes(' H-shape')) {
      return 6 // Frames
    }
    return 5 // Liftarms
  }
  // Match panels
  if (cat.includes('panels') || name.includes('panel')) {
    return 7
  }
  // Match gears
  if (cat.includes('gears') || name.includes('gear ')) {
    if (name.includes('differential') || name.includes('diff ')) {
      return 9 // Differentials
    }
    return 8 // Gears
  }
  // Match differentials
  if (name.includes('differential')) {
    return 9
  }
  // Match steering & suspension
  if (
    cat.includes('steering') ||
    cat.includes('suspension') ||
    name.includes('steering') ||
    name.includes('suspension') ||
    name.includes('shock absorber') ||
    name.includes('wishbone') ||
    name.includes('portal axle')
  ) {
    return 10
  }
  // Match wheels and tyres
  if (
    cat.includes('wheels') ||
    cat.includes('tyres') ||
    cat.includes('tires') ||
    name.includes('wheel ') ||
    name.includes('tyre ') ||
    name.includes('tire ') ||
    name.includes('sprocket') ||
    name.includes('track link')
  ) {
    return 11
  }
  // Match connectors
  if (cat.includes('connectors') || name.includes('connector') || name.includes('cross block')) {
    return 4
  }
  // Match pneumatics
  if (cat.includes('pneumatic') || name.includes('pneumatic') || name.includes('pump') || name.includes('cylinder')) {
    return 12
  }
  // Match linear actuators
  if (name.includes('linear actuator') || name.includes('actuator')) {
    return 13
  }
  // Match electronics
  if (
    cat.includes('electric') ||
    cat.includes('power functions') ||
    cat.includes('mindstorms') ||
    name.includes('motor') ||
    name.includes('battery') ||
    name.includes('led') ||
    name.includes('cable') ||
    name.includes('sensor') ||
    name.includes('receiver')
  ) {
    return 14
  }
  // Match hoses and strings
  if (
    cat.includes('hoses') ||
    cat.includes('strings') ||
    cat.includes('flexible') ||
    name.includes('hose') ||
    name.includes('string') ||
    name.includes('ribbon') ||
    name.includes('flex ')
  ) {
    return 15
  }

  // Fallback to "Other"
  return 17
}
