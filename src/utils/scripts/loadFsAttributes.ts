const loadedScripts: HTMLScriptElement[] = [];

/*
 *==========================================
 * CONFIGURATION - Source unique de vérité pour les modules Finsweet Attributes
 *==========================================
 */

// Liste des modules Finsweet Attributes à charger
// Pour ajouter/supprimer un module, modifiez uniquement cette liste
const FS_ATTRIBUTES_MODULES = ['list', 'toc', 'socialshare', 'readtime'] as const;

// Génère les attributs à partir des noms de modules (ajoute le préfixe 'fs-')
const FS_ATTRIBUTES = FS_ATTRIBUTES_MODULES.map((module) => `fs-${module}` as const);

/*
 *==========================================
 * TYPES
 *==========================================
 */

interface FinsweetAttributesModule {
  restart?: () => void;
  destroy?: () => void;
}

interface FinsweetAttributesModules {
  [key: string]: FinsweetAttributesModule;
}

interface FinsweetAttributes {
  destroy: () => void;
  restart?: () => void;
  modules?: FinsweetAttributesModules;
}

interface WindowWithFinsweet extends Window {
  FinsweetAttributes?: FinsweetAttributes;
}

export default function loadScript(
  src: string,
  attributes?: string | string[] | boolean,
  module?: boolean
) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');

    script.src = src;
    script.async = true;

    // Définir le type de script selon le paramètre module
    if (module !== false) {
      script.type = 'module';
    }

    // Ajouter les attributs selon le paramètre
    if (attributes) {
      if (typeof attributes === 'string') {
        // Si c'est une string, utiliser le nom de l'attribut fourni
        script.setAttribute(attributes, '');
      } else if (Array.isArray(attributes)) {
        // Si c'est un tableau, ajouter tous les attributs
        attributes.forEach((attr) => {
          script.setAttribute(attr, '');
        });
      } else if (attributes === true) {
        // Si c'est true, utiliser fs-list par défaut (rétrocompatibilité)
        script.setAttribute('fs-list', '');
      }
    }

    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    document.head.appendChild(script);
    loadedScripts.push(script);
  });
}

export function initFsAttributesScripts() {
  // Vérifier si FinsweetAttributes est déjà CHARGÉ (objet API).
  // ⚠️ Ne PAS bail-out si c'est encore le bootstrap queue (Array) — d'autres
  // modules (ex: dedupe-related-items) push `[name, cb]` dans la queue avant
  // que ce script tourne. Sans ce filtre, on prenait `[]` truthy pour "déjà
  // chargé" et le script attributes.js n'était jamais injecté.
  if (typeof window !== 'undefined') {
    const fa = (window as WindowWithFinsweet).FinsweetAttributes;
    if (fa && !Array.isArray(fa)) {
      return;
    }
  }

  // Vérifier si le script est déjà chargé dans le DOM pour éviter les doublons
  const scriptSrc = 'https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js';

  // Vérifier dans le DOM si le script existe déjà (même s'il n'est pas dans notre liste)
  const existingScriptInDom = Array.from(document.querySelectorAll('script')).find((script) => {
    const { src } = script;
    return (
      src === scriptSrc ||
      src.includes('@finsweet/attributes@2/attributes.js') ||
      src.includes('@finsweet/attributes') ||
      FS_ATTRIBUTES.some((attr) => script.hasAttribute(attr))
    );
  });

  // Si le script existe déjà dans le DOM, ne pas le recharger
  if (existingScriptInDom) {
    // Si ce n'est pas dans notre liste, l'ajouter pour le suivi
    if (!loadedScripts.includes(existingScriptInDom as HTMLScriptElement)) {
      loadedScripts.push(existingScriptInDom as HTMLScriptElement);
    }
    return;
  }

  // Vérifier aussi dans notre liste de scripts chargés
  if (
    loadedScripts.some((script) => {
      const { src } = script;
      return (
        src === scriptSrc ||
        src.includes('@finsweet/attributes@2/attributes.js') ||
        src.includes('@finsweet/attributes')
      );
    })
  ) {
    return;
  }

  // Charger le script seulement s'il n'existe pas
  /*
   *==========================================
   * ↳ Finsweet Attributes
   *==========================================
   */

  loadScript(scriptSrc, FS_ATTRIBUTES);

  /*
   *==========================================
   * ↳ Other CDN
   *==========================================
   */
  // FlowPlay+ - Video
  //   loadScript(
  //     'https://cdn.jsdelivr.net/gh/videsigns/webflow-tools@latest/Media%20Player/flowplayplus.js',
  //     undefined,
  //     false
  //   );
}

export function destroyFsAttributesScripts(): void {
  // Ne pas supprimer le script du DOM, seulement détruire les instances
  // Le script doit rester chargé pour pouvoir se réinitialiser
  if (typeof window === 'undefined') {
    return;
  }

  const { FinsweetAttributes } = window as WindowWithFinsweet;

  // Ne pas appeler .destroy() sur le bootstrap queue (Array) — il n'a pas
  // cette méthode. On agit uniquement sur l'objet API.
  if (FinsweetAttributes && !Array.isArray(FinsweetAttributes)) {
    try {
      FinsweetAttributes.destroy();
    } catch {
      // Silently fail - Finsweet Attributes might not be loaded yet
    }
  }
}

/**
 * Redémarre les modules Finsweet Attributes
 * Appelé après un changement de page avec Barba.js
 * @param retryCount - Nombre de tentatives si FinsweetAttributes n'est pas encore disponible
 */
export function restartFsAttributesModules(retryCount = 0): void {
  if (typeof window === 'undefined') {
    return;
  }

  const { FinsweetAttributes } = window as WindowWithFinsweet;

  // Si FinsweetAttributes n'est pas dispo OU encore en état queue (Array,
  // script pas encore exécuté), réessayer au prochain macrotask (max 3×).
  if (!FinsweetAttributes || Array.isArray(FinsweetAttributes)) {
    if (retryCount < 3) {
      setTimeout(() => {
        restartFsAttributesModules(retryCount + 1);
      }, 0);
    }
    return;
  }

  try {
    // Méthode 1: Utiliser restart() global si disponible (méthode recommandée)
    if (FinsweetAttributes.restart && typeof FinsweetAttributes.restart === 'function') {
      FinsweetAttributes.restart();
      return;
    }

    // Méthode 2: Fallback - Redémarrer chaque module individuellement
    const { modules } = FinsweetAttributes;
    if (modules && typeof modules === 'object') {
      // Utilise la liste centralisée des modules
      FS_ATTRIBUTES_MODULES.forEach((moduleName) => {
        const module = modules[moduleName];
        if (module?.restart && typeof module.restart === 'function') {
          try {
            module.restart();
          } catch {
            // Silently fail - module might not be available
          }
        }
      });
    }
  } catch {
    // Silently fail - Finsweet Attributes might have issues
  }
}
