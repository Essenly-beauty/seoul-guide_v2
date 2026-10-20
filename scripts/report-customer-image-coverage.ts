import { writeFileSync } from 'node:fs';
import { PLACES, PRODUCTS, BRAND_MARK_SRC } from '../lib/data';
import { DAISO_RANKING_DATA } from '../lib/generated/daiso-ranking-products';
import { placeImageSources } from '../lib/place-images';

const records = PLACES.map(place => ({
  id: place.id, name: place.name, nameKr: place.nameKr, type: place.type,
  photos: placeImageSources(place).filter(image => image.kind === 'photo').map(image => image.src),
  brandFallback: BRAND_MARK_SRC[place.type] ?? null,
}));
const report = {
  note: 'Source artwork is required for places/products without verified photos. Brand marks are identified separately from branch photography.',
  places: PLACES.length,
  withVerifiedPhotos: records.filter(record => record.photos.length).length,
  brandOnly: records.filter(record => !record.photos.length && record.brandFallback).length,
  categoryFallback: records.filter(record => !record.photos.length && !record.brandFallback).length,
  missingPlacePhotos: records.filter(record => !record.photos.length),
  missingDaisoProductPhotos: DAISO_RANKING_DATA.products.map(product => ({ id: product.id, nameKr: product.nameKr, brand: product.brand })),
  missingProductPhotos: PRODUCTS.filter(product => !product.imageUrl).map(product => ({ id: product.id, name: product.name, brand: product.brand })),
};
writeFileSync('reports/design/2026-10-20-image-coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ places: report.places, withVerifiedPhotos: report.withVerifiedPhotos, brandOnly: report.brandOnly, categoryFallback: report.categoryFallback, missingProductPhotos: report.missingProductPhotos.length }));
