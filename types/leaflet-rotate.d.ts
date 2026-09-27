/** The map runs leaflet-rotate-map, a Leaflet 1.9.4 build merged with the
 *  rotate branch, aliased over the bare "leaflet" specifier in next.config.mjs
 *  so react-leaflet and the app share one instance. Its typings live in its
 *  own module name, so this file teaches @types/leaflet the extra surface. */
import "leaflet";

declare module "leaflet" {
  interface MapOptions {
    /** Enable rotation support on the map (fork option). */
    rotate?: boolean;
  }
  interface Map {
    /** Current bearing in degrees, clockwise from north. */
    getBearing(): number;
    /** Set the bearing in degrees, clockwise from north; rotates about the centre. */
    setBearing(theta: number): void;
    /** Geographic bounds that cover the whole rotated viewport. */
    getCircumscribedBounds(): LatLngBounds;
    /** Bearing in radians, as the fork stores it. */
    _bearing?: number;
  }
  interface Point {
    /** Rotate about the origin by theta radians (screen y down). */
    rotate(theta: number): Point;
    rotateFrom(theta: number, pivot: Point): Point;
  }
}
