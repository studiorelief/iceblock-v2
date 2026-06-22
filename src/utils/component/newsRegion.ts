/**
 * Dropdown custom des régions de France sur le champ `#news-region`.
 *
 * Le markup est un simple `<input>` Webflow (avec son `name`, donc soumis
 * nativement par le formulaire). On l'enrichit avec Tom Select pour obtenir un
 * dropdown habillé listant les 18 régions administratives (13 métropolitaines
 * + 5 d'outre-mer).
 *
 * - `controlInput: null` retire le champ de saisie : pas de recherche, c'est un
 *   pur sélecteur cliquable.
 * - `maxItems: 1` force la sélection unique.
 * - La valeur retenue (le nom de la région) est réécrite par Tom Select dans
 *   l'`<input>` d'origine, que Webflow envoie tel quel.
 */

import './newsRegion.css';

import TomSelect from 'tom-select';

const SELECTOR = '#news-region, #region';
const PLACEHOLDER = 'Sélectionnez votre région';

// 18 régions administratives françaises (13 métropolitaines + 5 d'outre-mer).
const REGIONS = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
  'Guadeloupe',
  'Martinique',
  'Guyane',
  'La Réunion',
  'Mayotte',
];

export function initNewsRegion(): void {
  document.querySelectorAll<HTMLInputElement>(SELECTOR).forEach((input) => {
    if ((input as { tomselect?: unknown }).tomselect) return;

    new TomSelect(input, {
      options: REGIONS.map((region) => ({ value: region, text: region })),
      maxItems: 1,
      controlInput: null,
      placeholder: input.placeholder || PLACEHOLDER,
      allowEmptyOption: true,
      create: false,
    });
  });
}
