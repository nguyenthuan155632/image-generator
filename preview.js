const options = require('minimist')(process.argv.slice(2));

const tempfile = require('tempfile')
const request = require('sync-request')

const fs = require('fs'),
  fabric = require('fabric').fabric,
  im = require('imagemagick-stream')

const configFonts = require('./config/fonts')

console.log(options)

const canvas = new fabric.StaticCanvas(null, { width: options.canvas_width, height: options.canvas_height })
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
  const exportRatio = options.width / options.canvas_width

  canvas.setZoom(exportRatio)
  canvas.setWidth(options.width)
  canvas.setHeight(options.height)
  canvas.renderAll()

  const streamPreviewImage = canvas.createPNGStream()
  const outputPreview = tempfile(`preview_file_${options.uuid}.png`)
  const writePreview = fs.createWriteStream(outputPreview)

  const backgroundRes = request('GET', options.background_image_url)
  const backgroundFile = tempfile(`background_${options.uuid}.jpg`)
  fs.writeFileSync(backgroundFile, backgroundRes.body, 'binary')

  const convert = im()
    .set('geometry', `+${options.left}+${options.top}`)
    .set('composite', backgroundFile)
  streamPreviewImage.pipe(convert).pipe(writePreview)

  writePreview.on('finish', () => {
    fs.readFile(outputPreview, function(err, data){
      console.log(outputPreview)
      // res.writeHead(200, { 'Content-Type': 'image/png' } )
      // res.end(data, 'binary' )
    })
    console.log('finish preview image')
  })
  writePreview.on('error', (error) => {
    console.log('preview create error', error)
    writePreview.end()
  })
})