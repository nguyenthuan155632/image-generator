const options = require('minimist')(process.argv.slice(2));

const tempfile = require('tempfile')
const request = require('sync-request')

const fs = require('fs'),
  fabric = require('fabric').fabric,
  im = require('imagemagick-stream')

const configFonts = require('./config/fonts')

console.log(options)

const canvas = new fabric.StaticCanvas(null, { width: options.canvas_width, height: options.canvas_height })
const getExportSizes = (width, height, dpi) => {
  // 実寸(mm) * dpi / 25.4 = px
  const exportWidth = Math.round(width * dpi / 25.4)
  const exportHeight = Math.round(height * dpi / 25.4)
  return { exportWidth, exportHeight }
}

const convertToK100 = (canvas) => {
  const colorK100 = '#231815'
  const objects = canvas.getObjects()

  objects.forEach((object) => {
    if(object.type === 'image') {
      object.filters.push(new fabric.Image.filters.BlendColor({
        color: colorK100,
        mode: 'tint'
      }))
      object.applyFilters()
    } else if(object.type === 'text' || object.type === 'textbox') {
      object.set({ fill: colorK100 })
    }
  })
}

const dpi = options.color_type === 'full' ? 350 : 1200
const { exportWidth, exportHeight } = getExportSizes(options.width, options.height, dpi)
const exportRatio = exportWidth / options.canvas_width

const jsonRes = request('GET', options.json_url)
const submissionJson = JSON.parse(jsonRes.getBody('utf8'))

const fonts = submissionJson.objects.map(obj => obj.fontFamily)
configFonts.forEach((fontInfo) => {
  // Only load necessary fonts
  if (fonts.indexOf(fontInfo.cssName) >= 0) {
    const font = new fabric.nodeCanvas.Font(fontInfo.cssName, `${__dirname}/fonts/${fontInfo.fileName}.woff`)
    canvas.contextContainer.addFont(font)
  }
})

canvas.loadFromJSON(submissionJson, () => {
  canvas.setZoom(exportRatio)
  canvas.setWidth(exportWidth)
  canvas.setHeight(exportHeight)

  if(options.color_type === 'single') {
    convertToK100(canvas)
  }
  canvas.renderAll()

  const stream = canvas.createPNGStream()
  const outputFile = tempfile(`exported_file_${options.uuid}.png`)
  const out = fs.createWriteStream(outputFile)
  const convert = im().set('units', 'PixelsPerInch').set('density', dpi)
  stream.pipe(convert).pipe(out)

  out.on('finish', () => {
    fs.readFile(outputFile, function(err,data){
      console.log(outputFile)
    })
    // fs.unlinkSync(outputFile)
    console.log('finish submission')
  })
  out.on('error', (error) => {
    console.log('error submission', error)
    out.end()
  })
})