const fs = require('fs')
const path = require('path')

const pngPath = path.join(__dirname, '../build/icon.png')
const icoPath = path.join(__dirname, '../build/icon.ico')

try {
  const pngData = fs.readFileSync(pngPath)

  // ICO Header (6 bytes)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type (1 = ICO)
  header.writeUInt16LE(1, 4) // Number of images

  // Icon Directory Entry (16 bytes)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0) // Width (0 means 256)
  entry.writeUInt8(0, 1) // Height (0 means 256)
  entry.writeUInt8(0, 2) // Color palette count (0 for no palette)
  entry.writeUInt8(0, 3) // Reserved
  entry.writeUInt16LE(1, 4) // Color planes (1)
  entry.writeUInt16LE(32, 6) // Bits per pixel (32)
  entry.writeUInt32LE(pngData.length, 8) // Image size in bytes
  entry.writeUInt32LE(22, 12) // Image offset (6-byte header + 16-byte entry)

  // Concatenate header, entry, and png data
  const icoData = Buffer.concat([header, entry, pngData])

  fs.writeFileSync(icoPath, icoData)
  console.log('Successfully generated icon.ico from icon.png!')
} catch (error) {
  console.error('Error generating icon.ico:', error)
  process.exit(1)
}
