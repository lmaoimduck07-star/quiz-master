// Inspect more detailed context around images in CSDL_03.docx
const JSZip = require('jszip');
const fs = require('fs');

const filePath = 'C:/Users/nhuho/Desktop/New folder/CSDL_03.docx';
const buf = fs.readFileSync(filePath);

JSZip.loadAsync(buf).then(async (z) => {
  const docXml = await z.file('word/document.xml').async('string');

  // Build rId -> file mapping from word/_rels/document.xml.rels
  const relsXml = await z.file('word/_rels/document.xml.rels').async('string');
  const relMap = {};
  const relMatches = [...relsXml.matchAll(/Id="([^"]+)"[^>]+Target="([^"]+)"/g)];
  relMatches.forEach(m => {
    relMap[m[1]] = m[2]; // rId5 -> media/image1.png
  });

  // Parse paragraphs and show 3 paragraphs of context around each image para
  const paras = docXml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  
  const getText = (para) => [...para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('');
  
  const hasImage = (para) => para.includes('<w:drawing>') || para.includes('<w:pict>');
  
  const getImages = (para) => {
    const embeds = [...para.matchAll(/r:embed="([^"]+)"/g)].map(m => relMap[m[1]] || m[1]);
    return embeds;
  };

  console.log('=== Questions with Images (with context) ===\n');
  for (let i = 0; i < paras.length; i++) {
    if (hasImage(paras[i])) {
      const images = getImages(paras[i]);
      const prevTexts = [i-3, i-2, i-1].map(j => j >= 0 ? getText(paras[j]) : '').filter(Boolean);
      const nextTexts = [i+1, i+2, i+3].map(j => j < paras.length ? getText(paras[j]) : '').filter(Boolean);
      
      console.log(`--- Image para #${i} ---`);
      console.log('Images:', images);
      console.log('Before:', prevTexts.join(' | '));
      console.log('Current text:', getText(paras[i]) || '[none]');
      console.log('After:', nextTexts.join(' | '));
      console.log();
    }
  }
}).catch(e => console.error('Error:', e.message));
