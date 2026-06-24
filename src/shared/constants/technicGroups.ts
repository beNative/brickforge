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

  // 1. Match stickers
  if (cat.includes('sticker') || name.includes('sticker') || cat.includes('decal')) {
    return 16
  }

  // 2. Match electronics
  if (
    cat.includes('electric') ||
    cat.includes('power functions') ||
    cat.includes('mindstorms') ||
    cat.includes('nxt') ||
    cat.includes('ev3') ||
    name.includes('motor') ||
    name.includes('battery') ||
    name.includes('led') ||
    name.includes('cable') ||
    name.includes('sensor') ||
    name.includes('receiver') ||
    name.includes('transceiver') ||
    name.includes('mindstorms') ||
    (name.includes('hub') && (name.includes('smart') || name.includes('control+')))
  ) {
    return 14
  }

  // 3. Match pneumatics
  if (
    cat.includes('pneumatic') ||
    name.includes('pneumatic') ||
    name.includes('pump') ||
    (name.includes('cylinder') && (name.includes('pneumatic') || name.includes('valve'))) ||
    name.includes('pneumatic hose') ||
    name.includes('pneumatic switch')
  ) {
    return 12
  }

  // 4. Match hoses, strings, and flex parts (except pneumatic hoses matched above)
  if (
    cat.includes('hoses') ||
    cat.includes('strings') ||
    cat.includes('flexible') ||
    name.includes('hose') ||
    name.includes('string') ||
    name.includes('ribbon') ||
    name.includes('flex ') ||
    name.includes('flex-system')
  ) {
    return 15
  }

  // 5. Match linear actuators
  if (name.includes('linear actuator') || name.includes('actuator')) {
    return 13
  }

  // 6. Match wheels and tyres
  if (
    cat.includes('wheels') ||
    cat.includes('tyres') ||
    cat.includes('tires') ||
    name.includes('wheel ') ||
    name.includes('tyre ') ||
    name.includes('tire ') ||
    name.includes('sprocket') ||
    name.includes('track link') ||
    name.includes('rim ')
  ) {
    return 11
  }

  // 7. Match steering & suspension (Check before axles/connectors to catch portal axle/housing/joints)
  if (
    cat.includes('steering') ||
    cat.includes('suspension') ||
    name.includes('steering') ||
    name.includes('suspension') ||
    name.includes('shock absorber') ||
    name.includes('wishbone') ||
    name.includes('portal axle') ||
    name.includes('axle housing') ||
    name.includes('axle hub') ||
    name.includes('axle joint') ||
    name.includes('hub carrier') ||
    name.includes('cv joint') ||
    name.includes('steering arm') ||
    name.includes('steering hub')
  ) {
    return 10
  }

  // 8. Match differentials
  if (cat.includes('differential') || name.includes('differential')) {
    return 9
  }

  // 9. Match gears
  if (
    cat.includes('gears') ||
    name.includes('gear ') ||
    name.includes('spur gear') ||
    name.includes('bevel gear') ||
    name.includes('worm gear') ||
    name.includes('gear rack') ||
    name.includes('turntable')
  ) {
    return 8
  }

  // 10. Match bushes (Check before pins/connectors/axles to catch axle bushes)
  if (
    cat.includes('bush') ||
    name.includes('bush ') ||
    name.endsWith('bush') ||
    name.includes('axle bush') ||
    name.includes('sleeve')
  ) {
    return 3
  }

  // 11. Match connectors (Check before pins/axles/liftarms to catch driving rings, axle yokes, axle connectors)
  if (
    cat.includes('connectors') ||
    name.includes('connector') ||
    name.includes('cross block') ||
    name.includes('driving ring') ||
    name.includes('driving yoke') ||
    name.includes('changeover catch') ||
    name.includes('axle joiner') ||
    name.includes('axle extension') ||
    name.includes('ball joint') ||
    name.includes('towball')
  ) {
    return 4
  }

  // 12. Match pins (Check before axles/liftarms to catch axle pins)
  if (
    cat.includes('pins') ||
    cat.includes('pin ') ||
    name.includes('technic pin') ||
    name.includes('axle pin') ||
    name.includes('pin/axle') ||
    name.includes('pin with') ||
    name.includes('pin without') ||
    name.includes('double pin')
  ) {
    return 1
  }

  // 13. Match frames (Check before liftarms)
  if (
    cat.includes('frames') ||
    cat.includes('frame') ||
    name.includes('frame') ||
    name.includes('rectangular') ||
    name.includes(' H-shape')
  ) {
    return 6
  }

  // 14. Match liftarms and beams
  if (
    cat.includes('liftarm') ||
    name.includes('liftarm') ||
    cat.includes('beams') ||
    name.includes('technic beam') ||
    name.includes('beam ')
  ) {
    return 5
  }

  // 15. Match axles (Safe to match axles now because exclusions/reordering are in place)
  if (
    cat.includes('axles') ||
    name.startsWith('technic axle') ||
    name.includes('axle ') ||
    name.includes('flexible axle')
  ) {
    return 2
  }

  // 16. Match panels
  if (cat.includes('panels') || name.includes('panel')) {
    return 7
  }

  // Fallback to "Other"
  return 17
}
