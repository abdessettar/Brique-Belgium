/**
 * Every colour used on the site. The palette is named after building materials: brick, Soignies
 * bluestone, Grand Place gilt and mortar. Checked for colour vision deficiency against the page
 * colour: the three regions clear every pairwise check (worst pair gilt against brick, dE 17.4
 * under deuteranopia, every mark at or above 3.26:1), the two classes clear dE 19.4, and every
 * ramp is a single hue with monotone lightness whose lightest class still clears 2:1.
 *
 * Gilt is a mark colour only. Wherever Brussels appears as words (a direct label, a legend, a
 * table swatch) use REGION_TEXT, which darkens gilt to 4.78:1; brick and bluestone already clear
 * 4.5:1 so their text variant is the mark colour.
 */

export const PAGE = "#f2f1ee";
export const PAPER = "#fafaf7"; // tooltip background, one step lighter than the page
export const INK_1 = "#1f1a17";
export const INK_2 = "#4a423c";
export const INK_3 = "#6b625a";
export const HAIRLINE = "#cdcbc4";
export const GRID = "#d7d5ce";
export const HATCH = "#b6b3ab";
export const MORTAR = "#b3aa9b"; // the neutral: diverging pivot, the D band, "same as reference"

export const BRICK = "#8f2f1c";
export const BLUESTONE = "#2b5c98";
export const GILT = "#ad7a0a";
export const GILT_TEXT = "#8a6110";

export const REGIONS = ["Flanders", "Wallonia", "Brussels"];
export const REGION_COLOR = {Flanders: BRICK, Wallonia: BLUESTONE, Brussels: GILT};
export const REGION_TEXT = {Flanders: BRICK, Wallonia: BLUESTONE, Brussels: GILT_TEXT};
export const REGION_MATERIAL = {Flanders: "brick", Wallonia: "bluestone", Brussels: "gilt"};

export const CLASSES = ["House", "Apartment"];
export const CLASS_COLOR = {House: BRICK, Apartment: BLUESTONE};
export const CLASS_TEXT = CLASS_COLOR;

/** Verdict ink for a sentence, never a fill. */
export const GOOD = "#2f6b3d";
export const BAD = "#7a2413";

/** Sequential magnitude, one hue (brick), light to dark. Seven classes for maps, where the
 *  lightest class must still read as filled next to a hatched no-data commune (2.05:1). */
export const BRICK_7 = ["#d79b7a", "#c28363", "#ae6b4d", "#9a5337", "#853b23", "#70230d", "#580c00"];

/** Eight steps for hexbins and matrices, where the lightest cell sits among dense neighbours and
 *  may recede a little further toward the page (2.02:1). */
export const BRICK_8 = ["#cea081", "#bd896a", "#ac7355", "#9b5d40", "#8a482d", "#793219", "#671b04", "#4f0c02"];

/** Diverging: bluestone below the pivot, mortar at it, brick above. Three classes per arm. */
export const DIVERGING_7 = ["#064180", "#4174ad", "#79a9db", MORTAR, "#db9470", "#aa593b", "#781c09"];

/** EPC bands are thermal, not green and red: bluestone for the insulated bands A++ to C, mortar
 *  for D (the reference the premium is measured against), brick for E to G, which leak heat. The
 *  adjacent pairs A++/A+ and B/C sit at the CVD floor, so the letter is always printed on or
 *  beside every band mark. */
export const EPC_BANDS = ["A++", "A+", "A", "B", "C", "D", "E", "F", "G"];
export const EPC_COLOR = {
  "A++": "#033c77", "A+": "#245791", "A": "#4273a9", "B": "#618fc1", "C": "#81acd9",
  "D": MORTAR, "E": "#da8b66", "F": "#a45337", "G": "#6f1b0a"
};

/** Text colour that clears contrast on a given fill: ink on the light classes, page on the dark. */
export function inkOn(fill) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.32 ? INK_1 : PAGE;
}
