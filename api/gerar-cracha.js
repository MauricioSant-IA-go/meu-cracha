const sharp = require('sharp');
const fetch = require('node-fetch');
 
async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao baixar: ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}
 
async function createCircularImage(imageBuffer, size = 232) {
  return sharp(imageBuffer)
    .resize(size, size, { fit: 'cover', position: 'center' })
    .toBuffer()
    .then(resized => {
      const circleSvg = `<svg width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
      </svg>`;
      
      return sharp(resized)
        .composite([{ 
          input: Buffer.from(circleSvg),
          blend: 'dest-in'
        }])
        .jpeg({ quality: 88 })
        .toBuffer();
    });
}
 
module.exports = async (req, res) => {
  try {
    const data = req.method === 'POST' ? req.body : req.query;
    const { nome, foto_url } = data;
 
    if (!nome || !foto_url) {
      return res.status(400).json({ erro: 'Parâmetros obrigatórios: nome e foto_url' });
    }
 
    console.log(`[CRACHA] Processando: ${nome}`);
 
    const BASE_IMAGE_URL = 'https://i.ibb.co/wh7zKws2/template-ingresso.png';
 
    const templateBuffer = await downloadImage(BASE_IMAGE_URL);
    const fotoBuffer = await downloadImage(foto_url);
 
    const fotoCircular = await createCircularImage(fotoBuffer, 232);
 
    const metadata = await sharp(templateBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;
 
    console.log(`[CRACHA] Template: ${width}x${height}px`);
 
    const circleX = Math.round(width / 2);
    const circleY = Math.round(height * 0.35);
    const textY = circleY + 232 + 60;
 
    const textSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          text {
            font-family: Arial, sans-serif;
            font-size: 52px;
            font-weight: bold;
            fill: #E8C782;
            text-anchor: middle;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
          }
        </style>
      </defs>
      <text x="${width / 2}" y="${textY}">
        ${nome.toUpperCase().trim()}
      </text>
    </svg>`;
 
    console.log(`[CRACHA] Posição: x=${circleX}, y=${circleY}, textY=${textY}`);
 
    const imagemFinal = await sharp(templateBuffer)
      .composite([
        { 
          input: fotoCircular, 
          left: circleX - 116,
          top: circleY - 116
        }
      ])
      .composite([
        {
          input: Buffer.from(textSvg),
        }
      ])
      .jpeg({ quality: 88 })
      .toBuffer();
 
    console.log(`[CRACHA] ✅ Imagem gerada: ${imagemFinal.length} bytes`);
 
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', imagemFinal.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(imagemFinal);
 
  } catch (erro) {
    console.error('[CRACHA] ❌ Erro:', erro.message);
    res.status(500).json({ erro: erro.message });
  }
};
