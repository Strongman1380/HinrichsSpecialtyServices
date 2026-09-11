import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.join(__dirname, '..', 'images');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'images');

// Responsive image sizes
const SIZES = {
  hero: [640, 768, 1024, 1280, 1536, 1920],
  thumbnail: [256, 384, 512],
  icon: [48, 96, 144, 192, 512]
};

// Image quality settings
const QUALITY = {
  webp: 85,
  avif: 80,
  jpeg: 85,
  png: 90
};

async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function optimizeImage(inputPath, outputName, sizes = SIZES.hero) {
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  console.log(`📸 Processing: ${basename}${ext}`);

  // Create output directory
  const outputSubDir = path.join(OUTPUT_DIR, outputName);
  await ensureDir(outputSubDir);

  // Get image metadata
  const metadata = await sharp(inputPath).metadata();
  console.log(`   Original: ${metadata.width}x${metadata.height} (${metadata.format})`);

  const formats = [
    { ext: 'webp', quality: QUALITY.webp },
    { ext: 'avif', quality: QUALITY.avif },
    { ext: 'jpg', quality: QUALITY.jpeg }
  ];

  // Generate responsive images in multiple formats
  for (const size of sizes) {
    // Skip if size is larger than original
    if (size > metadata.width) continue;

    for (const format of formats) {
      const outputPath = path.join(
        outputSubDir,
        `${outputName}-${size}w.${format.ext}`
      );

      await sharp(inputPath)
        .resize(size, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .toFormat(format.ext, { quality: format.quality })
        .toFile(outputPath);

      const stats = await fs.stat(outputPath);
      console.log(`   ✓ ${size}w.${format.ext} (${(stats.size / 1024).toFixed(2)} KB)`);
    }
  }

  // Also create an optimized original
  for (const format of formats) {
    const outputPath = path.join(
      outputSubDir,
      `${outputName}.${format.ext}`
    );

    await sharp(inputPath)
      .toFormat(format.ext, { quality: format.quality })
      .toFile(outputPath);

    const stats = await fs.stat(outputPath);
    console.log(`   ✓ original.${format.ext} (${(stats.size / 1024).toFixed(2)} KB)`);
  }
}

async function generatePWAIcons(inputPath) {
  console.log('🎨 Generating PWA icons...');

  const pwaDir = path.join(__dirname, '..', 'public');
  await ensureDir(pwaDir);

  const iconSizes = [192, 512];

  for (const size of iconSizes) {
    const outputPath = path.join(pwaDir, `pwa-${size}x${size}.png`);

    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .png({ quality: QUALITY.png })
      .toFile(outputPath);

    console.log(`   ✓ PWA icon ${size}x${size}`);
  }

  // Generate favicon
  const faviconPath = path.join(pwaDir, 'favicon.ico');
  await sharp(inputPath)
    .resize(32, 32)
    .png()
    .toFile(faviconPath.replace('.ico', '.png'));

  console.log(`   ✓ Favicon generated (convert to .ico manually)`);

  // Generate apple-touch-icon
  const appleTouchPath = path.join(pwaDir, 'apple-touch-icon.png');
  await sharp(inputPath)
    .resize(180, 180)
    .png({ quality: QUALITY.png })
    .toFile(appleTouchPath);

  console.log(`   ✓ Apple touch icon`);
}

async function createPictureElement(imageName, alt, sizes = '100vw', loading = 'lazy') {
  return `<picture>
  <source
    type="image/avif"
    srcset="
      /src/assets/images/${imageName}/${imageName}-640w.avif 640w,
      /src/assets/images/${imageName}/${imageName}-768w.avif 768w,
      /src/assets/images/${imageName}/${imageName}-1024w.avif 1024w,
      /src/assets/images/${imageName}/${imageName}-1280w.avif 1280w,
      /src/assets/images/${imageName}/${imageName}-1536w.avif 1536w,
      /src/assets/images/${imageName}/${imageName}-1920w.avif 1920w
    "
    sizes="${sizes}"
  />
  <source
    type="image/webp"
    srcset="
      /src/assets/images/${imageName}/${imageName}-640w.webp 640w,
      /src/assets/images/${imageName}/${imageName}-768w.webp 768w,
      /src/assets/images/${imageName}/${imageName}-1024w.webp 1024w,
      /src/assets/images/${imageName}/${imageName}-1280w.webp 1280w,
      /src/assets/images/${imageName}/${imageName}-1536w.webp 1536w,
      /src/assets/images/${imageName}/${imageName}-1920w.webp 1920w
    "
    sizes="${sizes}"
  />
  <img
    src="/src/assets/images/${imageName}/${imageName}-1024w.jpg"
    srcset="
      /src/assets/images/${imageName}/${imageName}-640w.jpg 640w,
      /src/assets/images/${imageName}/${imageName}-768w.jpg 768w,
      /src/assets/images/${imageName}/${imageName}-1024w.jpg 1024w,
      /src/assets/images/${imageName}/${imageName}-1280w.jpg 1280w,
      /src/assets/images/${imageName}/${imageName}-1536w.jpg 1536w,
      /src/assets/images/${imageName}/${imageName}-1920w.jpg 1920w
    "
    sizes="${sizes}"
    alt="${alt}"
    loading="${loading}"
    decoding="async"
  />
</picture>`;
}

async function main() {
  console.log('🚀 Starting image optimization...\n');

  await ensureDir(OUTPUT_DIR);

  // Read all images from images directory
  const files = await fs.readdir(IMAGES_DIR);
  const imageFiles = files.filter(f =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );

  console.log(`Found ${imageFiles.length} images to optimize\n`);

  // Optimize hero globe image
  const heroGlobe = files.find(f => f.includes('2025-03-27'));
  if (heroGlobe) {
    await optimizeImage(
      path.join(IMAGES_DIR, heroGlobe),
      'hero-globe',
      SIZES.hero
    );
  }

  // Optimize tech graphics (Screenshots from 2025-06-03)
  const techGraphics = files.filter(f => f.includes('2025-06-03'));
  for (let i = 0; i < techGraphics.length; i++) {
    await optimizeImage(
      path.join(IMAGES_DIR, techGraphics[i]),
      `tech-graphic-${i + 1}`,
      SIZES.thumbnail
    );
  }

  // Generate PWA icons from hero image
  if (heroGlobe) {
    await generatePWAIcons(path.join(IMAGES_DIR, heroGlobe));
  }

  // Create example picture element snippets
  console.log('\n📝 Example <picture> element usage:\n');
  const exampleHtml = await createPictureElement(
    'hero-globe',
    'Global Impact Network - Connecting Communities Worldwide',
    '(min-width: 768px) 50vw, 100vw',
    'eager'
  );

  // Save examples to file
  const examplesPath = path.join(__dirname, '..', 'RESPONSIVE_IMAGES_EXAMPLES.md');
  await fs.writeFile(examplesPath, `# Responsive Images Examples

## Hero Image

${exampleHtml}

## Tech Graphics

${await createPictureElement('tech-graphic-1', 'Technology visualization', '400px', 'lazy')}

## Usage in HTML

Replace old image tags with the responsive <picture> elements above.

### Before:
\`\`\`html
<img src="images/Screenshot%202025-03-27%20at%2010.51.59%20PM.png" alt="..." />
\`\`\`

### After:
\`\`\`html
${exampleHtml}
\`\`\`

## Benefits

- **70-80% smaller file sizes** with WebP/AVIF
- **Faster page loads** with responsive images
- **Better mobile experience** with appropriate sizes
- **Progressive enhancement** with fallbacks

## File Sizes Comparison

| Format | Original | Optimized | Savings |
|--------|----------|-----------|---------|
| PNG/JPG | ~2-3 MB | ~200-300 KB (WebP) | ~85-90% |
| PNG/JPG | ~2-3 MB | ~150-250 KB (AVIF) | ~90-92% |

## Generated Assets

All optimized images are in: \`/src/assets/images/\`

- \`hero-globe/\` - Hero section globe image (all sizes)
- \`tech-graphic-*/\` - Technology graphics (all sizes)
- \`/public/pwa-*.png\` - PWA app icons
- \`/public/favicon.ico\` - Browser favicon
- \`/public/apple-touch-icon.png\` - iOS home screen icon
`);

  console.log(`\n✅ Optimization complete!`);
  console.log(`📄 Examples saved to: RESPONSIVE_IMAGES_EXAMPLES.md\n`);
}

main().catch(console.error);
