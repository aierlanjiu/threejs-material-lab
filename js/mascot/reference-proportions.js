// Proportions measured from the front/side turnarounds in design_sheets/ortho_blueprints.
// Units share one scale per character. Preserve these ratios before adjusting camera or CMF.
const spow = (v,p) => v * Math.pow((v*v+.025)/1.025,(p-1)/2);
export const HOODIE = Object.freeze({
  headCenter: 2.18, headWidth: 2.16, headHeight: 1.74, bodyWidth: 1.76,
  bodyTop: 1.29, bootTop: .48, faceCenter: 1.77, faceWidth: 1.36, faceHeight: .90,
  aperture: .64, tilt: .50, reviewHeight: 3.52,
});
export function hoodieHeadShape(p) {
  const y = p.y;
  p.set(1.025 * spow(p.x, .90) * (1 - .17 * y),
    y >= 0 ? .93 * y : .81 * spow(y, .62),
    .97 * spow(p.z, p.z > 0 ? .43 : .72) * (1 - .05 * y));
  return p;
}
export function hoodieBodyShape(p) {
  return p.set(.76 * spow(p.x, .75), .44 * spow(p.y, .65), .64 * spow(p.z, .75));
}
export const ASTRO = Object.freeze({ headCenter: 2.64, headWidth: 2.12, headHeight: 1.80, bodyScale: 1.42, bodyCenter: 1.22, reviewHeight: 4.02 });
export function astroHeadShape(p) {
  return p.set(1.055 * spow(p.x, .85), .895 * spow(p.y, .82), .88 * spow(p.z, .78));
}
