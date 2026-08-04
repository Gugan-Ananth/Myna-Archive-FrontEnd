import type { Locale } from "./types";

export type MessageKey = keyof typeof en;

const en = {
  // Brand / chrome
  brandName: "Myna Archive",
  add: "Add",
  goBack: "Go back",
  dismiss: "Dismiss",
  language: "Language",
  chooseLanguage: "Choose language",

  // Search
  searchPlaceholder: "Search your archive",
  searchArchive: "Search archive",
  clearSearch: "Clear search",
  search: "Search",

  // Home
  unableToLoadArchive: "Unable to load archive",
  loadErrorFallback: "Could not load the archive. Is the backend running?",
  loadErrorHint:
    "Start the Nest API on port 3001 and ensure NEXT_PUBLIC_API_URL points at it.",
  itemCountOne: "{count} item",
  itemCountMany: "{count} items",
  showingOf: "Showing {shown} of {total}",
  loadMore: "Load more",
  loadingMore: "Loading…",
  archiveEmpty: "Your archive is empty",
  archiveEmptyHint: "Use Add to upload an image or video.",
  noItemsMatch: "No items match",
  noItemsMatchHint:
    "Try clearing the search or tag filters, or add something new.",
  savedToArchive: "Saved to your archive.",
  savedVideoProcessing:
    "Saved. Thumbnail and playback may take a minute while the video processes.",
  resultsFor: "Results for “{query}”",
  previewUnavailable: "Preview unavailable",
  videoProcessingShort: "Processing…",
  videoThumbPending: "Thumbnail soon",
  video: "Video",
  image: "Image",

  // Tags
  filterByTags: "Filter by tags",
  showAllItems: "Show all items",
  all: "All",
  removeFilter: "Remove filter {tag}",
  filterBy: "Filter by {tag}",
  moreSelected: "+{count} more",
  alsoSelected: "Also selected",
  selectedTags: "Selected tags",
  selected: "Selected",
  clearAll: "Clear all",
  moreTags: "More tags",
  searchMoreTags: "Search more tags",
  searchTags: "Search tags",
  findATag: "Find a tag",
  noTagsYet: "No tags yet. Add some when you create an item.",
  noTagsMatch: "No tags match “{query}”.",
  nSelected: "{count} selected",

  // Create
  unsupportedFileType:
    "Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, WebM, or MOV.",
  fileTooLarge: "File is too large ({size}). Max for {type} is {limit}.",
  addAtLeastOneTag: "Add at least one tag before saving.",
  nameRequired: "Name is required.",
  somethingWentWrong: "Something went wrong while saving.",
  dropToUpload: "Drop to upload",
  clickOrDrag: "Click or drag an image or video",
  acceptedFormats: "PNG, JPG, WebP, GIF · MP4, WebM, MOV",
  sizeLimits: "Up to {imageMax} images · {videoMax} videos",
  changeMedia: "Change {media}",
  name: "Name",
  nameThis: "Name this {media}",
  tags: "Tags",
  required: "(required)",
  addAtLeastOneTagHint: "Add at least one tag to organize this item",
  removeTag: "Remove {tag}",
  addTag: "Add a tag",
  addTagButton: "Add",
  rating: "Rating",
  description: "Description",
  optionalNotes: "Optional notes about this {media}",
  preparingUpload: "Preparing upload…",
  uploadingMedia: "Uploading media…",
  savingToArchive: "Saving to archive…",
  preparingPreview: "Preparing preview…",
  videoUploadAlmostDone:
    "Upload finishing — Bunny will encode the video next.",
  videoSavingHint:
    "Saving now. Playback and the grid thumbnail appear once encoding finishes.",
  saving: "Saving…",
  saveToArchive: "Save to archive",
  cancelUpload: "Cancel upload",
  uploadCancelled: "Upload cancelled.",
  leaveWhileUploading:
    "Upload in progress. Leaving this page will cancel the transfer.",

  // Detail
  hideDetails: "Hide details",
  showDetails: "Show details",
  editVideoDetails: "Edit video details",
  editImageDetails: "Edit image details",
  edit: "Edit",
  noTags: "No tags",
  addTagEllipsis: "Add tag…",
  noDescription: "No description.",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  deleting: "Deleting…",
  atLeastOneTagRequired: "At least one tag is required.",
  couldNotSave: "Could not save changes.",
  deleteConfirm:
    "Delete “{name}”? This removes the item and its media permanently.",
  couldNotDelete: "Could not delete item.",

  // Rating input
  enterRating: "Enter a rating",
  enterValidNumber: "Enter a valid number",
  cantBeMoreThan: "Can't be more than {max}",
  cantBeLessThan: "Can't be less than {min}",
  ratingAria: "Rating {value}",

  // Zoom / media
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  resetZoom: "Reset zoom",
  couldNotLoadImage: "Could not load this image.",

  // Not found
  imageNotFound: "Image not found",
  backToArchive: "Back to archive",
  notFound: "Not found",

  // Video player (subset)
  videoPlayer: "Video player",
  playVideo: "Play video",
  play: "Play",
  pause: "Pause",
  mute: "Mute",
  unmute: "Unmute",
  seek: "Seek",
  fullscreen: "Fullscreen",
  exitFullscreen: "Exit fullscreen",
  videoProcessingTitle: "Video is processing",
  videoProcessingHint:
    "Bunny Stream is still encoding this video. Playback starts automatically when ready.",
  videoChecking: "Checking video…",
  videoWaitElapsed: "Waiting · {seconds}s",
  videoRetry: "Try again",
  videoRetrying: "Checking…",
  videoUnavailable: "This video couldn’t be loaded.",
  videoUnavailableHint:
    "Encoding may have failed, or the file isn’t ready yet. Try again in a moment.",
  videoPreviewUnavailable:
    "This browser can’t preview this file. You can still save it — Bunny will encode for playback.",
} as const;

const es: Record<MessageKey, string> = {
  brandName: "Myna Archive",
  add: "Añadir",
  goBack: "Volver",
  dismiss: "Cerrar",
  language: "Idioma",
  chooseLanguage: "Elegir idioma",

  searchPlaceholder: "Busca en tu archivo",
  searchArchive: "Buscar en el archivo",
  clearSearch: "Borrar búsqueda",
  search: "Buscar",

  unableToLoadArchive: "No se pudo cargar el archivo",
  loadErrorFallback:
    "No se pudo cargar el archivo. ¿Está el backend en marcha?",
  loadErrorHint:
    "Arranca la API Nest en el puerto 3001 y asegúrate de que NEXT_PUBLIC_API_URL apunta a ella.",
  itemCountOne: "{count} elemento",
  itemCountMany: "{count} elementos",
  showingOf: "Mostrando {shown} de {total}",
  loadMore: "Cargar más",
  loadingMore: "Cargando…",
  archiveEmpty: "Tu archivo está vacío",
  archiveEmptyHint: "Usa Añadir para subir una imagen o un vídeo.",
  noItemsMatch: "Ningún elemento coincide",
  noItemsMatchHint:
    "Prueba a borrar la búsqueda o los filtros de etiquetas, o añade algo nuevo.",
  savedToArchive: "Guardado en tu archivo.",
  savedVideoProcessing:
    "Guardado. La miniatura y la reproducción pueden tardar un minuto mientras se procesa el vídeo.",
  resultsFor: "Resultados para “{query}”",
  previewUnavailable: "Vista previa no disponible",
  videoProcessingShort: "Procesando…",
  videoThumbPending: "Miniatura pronto",
  video: "Vídeo",
  image: "Imagen",

  filterByTags: "Filtrar por etiquetas",
  showAllItems: "Mostrar todos los elementos",
  all: "Todas",
  removeFilter: "Quitar filtro {tag}",
  filterBy: "Filtrar por {tag}",
  moreSelected: "+{count} más",
  alsoSelected: "También seleccionadas",
  selectedTags: "Etiquetas seleccionadas",
  selected: "Seleccionadas",
  clearAll: "Borrar todas",
  moreTags: "Más etiquetas",
  searchMoreTags: "Buscar más etiquetas",
  searchTags: "Buscar etiquetas",
  findATag: "Buscar una etiqueta",
  noTagsYet: "Aún no hay etiquetas. Añade algunas al crear un elemento.",
  noTagsMatch: "Ninguna etiqueta coincide con “{query}”.",
  nSelected: "{count} seleccionadas",

  unsupportedFileType:
    "Tipo de archivo no compatible. Usa JPEG, PNG, WebP, GIF, MP4, WebM o MOV.",
  fileTooLarge:
    "El archivo es demasiado grande ({size}). El máximo para {type} es {limit}.",
  addAtLeastOneTag: "Añade al menos una etiqueta antes de guardar.",
  nameRequired: "El nombre es obligatorio.",
  somethingWentWrong: "Algo salió mal al guardar.",
  dropToUpload: "Suelta para subir",
  clickOrDrag: "Haz clic o arrastra una imagen o un vídeo",
  acceptedFormats: "PNG, JPG, WebP, GIF · MP4, WebM, MOV",
  sizeLimits: "Hasta {imageMax} en imágenes · {videoMax} en vídeos",
  changeMedia: "Cambiar {media}",
  name: "Nombre",
  nameThis: "Nombra este {media}",
  tags: "Etiquetas",
  required: "(obligatorio)",
  addAtLeastOneTagHint: "Añade al menos una etiqueta para organizar este elemento",
  removeTag: "Quitar {tag}",
  addTag: "Añadir una etiqueta",
  addTagButton: "Añadir",
  rating: "Valoración",
  description: "Descripción",
  optionalNotes: "Notas opcionales sobre este {media}",
  preparingUpload: "Preparando subida…",
  uploadingMedia: "Subiendo media…",
  savingToArchive: "Guardando en el archivo…",
  preparingPreview: "Preparando vista previa…",
  videoUploadAlmostDone:
    "Subida casi lista — Bunny codificará el vídeo a continuación.",
  videoSavingHint:
    "Guardando. La reproducción y la miniatura de la cuadrícula aparecerán cuando termine la codificación.",
  saving: "Guardando…",
  saveToArchive: "Guardar en el archivo",
  cancelUpload: "Cancelar subida",
  uploadCancelled: "Subida cancelada.",
  leaveWhileUploading:
    "Hay una subida en curso. Si sales de esta página, se cancelará la transferencia.",

  hideDetails: "Ocultar detalles",
  showDetails: "Mostrar detalles",
  editVideoDetails: "Editar detalles del vídeo",
  editImageDetails: "Editar detalles de la imagen",
  edit: "Editar",
  noTags: "Sin etiquetas",
  addTagEllipsis: "Añadir etiqueta…",
  noDescription: "Sin descripción.",
  save: "Guardar",
  cancel: "Cancelar",
  delete: "Eliminar",
  deleting: "Eliminando…",
  atLeastOneTagRequired: "Se requiere al menos una etiqueta.",
  couldNotSave: "No se pudieron guardar los cambios.",
  deleteConfirm:
    "¿Eliminar “{name}”? Se borrará el elemento y su media de forma permanente.",
  couldNotDelete: "No se pudo eliminar el elemento.",

  enterRating: "Introduce una valoración",
  enterValidNumber: "Introduce un número válido",
  cantBeMoreThan: "No puede ser mayor que {max}",
  cantBeLessThan: "No puede ser menor que {min}",
  ratingAria: "Valoración {value}",

  zoomIn: "Acercar",
  zoomOut: "Alejar",
  resetZoom: "Restablecer zoom",
  couldNotLoadImage: "No se pudo cargar esta imagen.",

  imageNotFound: "Imagen no encontrada",
  backToArchive: "Volver al archivo",
  notFound: "No encontrado",

  videoPlayer: "Reproductor de vídeo",
  playVideo: "Reproducir vídeo",
  play: "Reproducir",
  pause: "Pausar",
  mute: "Silenciar",
  unmute: "Activar sonido",
  seek: "Buscar",
  fullscreen: "Pantalla completa",
  exitFullscreen: "Salir de pantalla completa",
  videoProcessingTitle: "El vídeo se está procesando",
  videoProcessingHint:
    "Bunny Stream aún está codificando este vídeo. La reproducción empezará sola cuando esté listo.",
  videoChecking: "Comprobando el vídeo…",
  videoWaitElapsed: "Esperando · {seconds}s",
  videoRetry: "Reintentar",
  videoRetrying: "Comprobando…",
  videoUnavailable: "No se pudo cargar este vídeo.",
  videoUnavailableHint:
    "Es posible que la codificación haya fallado o que el archivo aún no esté listo. Inténtalo de nuevo en un momento.",
  videoPreviewUnavailable:
    "Este navegador no puede previsualizar este archivo. Aun así puedes guardarlo — Bunny lo codificará para la reproducción.",
};

const ca: Record<MessageKey, string> = {
  brandName: "Myna Archive",
  add: "Afegeix",
  goBack: "Torna",
  dismiss: "Tanca",
  language: "Idioma",
  chooseLanguage: "Tria l'idioma",

  searchPlaceholder: "Cerca al teu arxiu",
  searchArchive: "Cerca a l'arxiu",
  clearSearch: "Esborra la cerca",
  search: "Cerca",

  unableToLoadArchive: "No s'ha pogut carregar l'arxiu",
  loadErrorFallback:
    "No s'ha pogut carregar l'arxiu. Està el backend en marxa?",
  loadErrorHint:
    "Inicia l'API Nest al port 3001 i assegura't que NEXT_PUBLIC_API_URL hi apunta.",
  itemCountOne: "{count} element",
  itemCountMany: "{count} elements",
  showingOf: "Es mostren {shown} de {total}",
  loadMore: "Carrega'n més",
  loadingMore: "S'està carregant…",
  archiveEmpty: "El teu arxiu és buit",
  archiveEmptyHint: "Fes servir Afegeix per pujar una imatge o un vídeo.",
  noItemsMatch: "Cap element no coincideix",
  noItemsMatchHint:
    "Prova d'esborrar la cerca o els filtres d'etiquetes, o afegeix-ne un de nou.",
  savedToArchive: "Desat al teu arxiu.",
  savedVideoProcessing:
    "Desat. La miniatura i la reproducció poden trigar un minut mentre es processa el vídeo.",
  resultsFor: "Resultats per a “{query}”",
  previewUnavailable: "Vista prèvia no disponible",
  videoProcessingShort: "S'està processant…",
  videoThumbPending: "Miniatura aviat",
  video: "Vídeo",
  image: "Imatge",

  filterByTags: "Filtra per etiquetes",
  showAllItems: "Mostra tots els elements",
  all: "Totes",
  removeFilter: "Treu el filtre {tag}",
  filterBy: "Filtra per {tag}",
  moreSelected: "+{count} més",
  alsoSelected: "També seleccionades",
  selectedTags: "Etiquetes seleccionades",
  selected: "Seleccionades",
  clearAll: "Esborra-les totes",
  moreTags: "Més etiquetes",
  searchMoreTags: "Cerca més etiquetes",
  searchTags: "Cerca etiquetes",
  findATag: "Troba una etiqueta",
  noTagsYet: "Encara no hi ha etiquetes. Afegeix-ne en crear un element.",
  noTagsMatch: "Cap etiqueta no coincideix amb “{query}”.",
  nSelected: "{count} seleccionades",

  unsupportedFileType:
    "Tipus de fitxer no compatible. Usa JPEG, PNG, WebP, GIF, MP4, WebM o MOV.",
  fileTooLarge:
    "El fitxer és massa gran ({size}). El màxim per a {type} és {limit}.",
  addAtLeastOneTag: "Afegeix almenys una etiqueta abans de desar.",
  nameRequired: "El nom és obligatori.",
  somethingWentWrong: "Alguna cosa ha fallat en desar.",
  dropToUpload: "Deixa anar per pujar",
  clickOrDrag: "Fes clic o arrossega una imatge o un vídeo",
  acceptedFormats: "PNG, JPG, WebP, GIF · MP4, WebM, MOV",
  sizeLimits: "Fins a {imageMax} en imatges · {videoMax} en vídeos",
  changeMedia: "Canvia {media}",
  name: "Nom",
  nameThis: "Anomena aquest {media}",
  tags: "Etiquetes",
  required: "(obligatori)",
  addAtLeastOneTagHint: "Afegeix almenys una etiqueta per organitzar aquest element",
  removeTag: "Treu {tag}",
  addTag: "Afegeix una etiqueta",
  addTagButton: "Afegeix",
  rating: "Valoració",
  description: "Descripció",
  optionalNotes: "Notes opcionals sobre aquest {media}",
  preparingUpload: "Preparant la pujada…",
  uploadingMedia: "Pujant el media…",
  savingToArchive: "Desant a l'arxiu…",
  preparingPreview: "Preparant la vista prèvia…",
  videoUploadAlmostDone:
    "Pujada gairebé a punt — Bunny codificarà el vídeo a continuació.",
  videoSavingHint:
    "Desant. La reproducció i la miniatura de la graella apareixeran quan acabi la codificació.",
  saving: "Desant…",
  saveToArchive: "Desa a l'arxiu",
  cancelUpload: "Cancel·la la pujada",
  uploadCancelled: "Pujada cancel·lada.",
  leaveWhileUploading:
    "Hi ha una pujada en curs. Si surts d'aquesta pàgina, es cancel·larà la transferència.",

  hideDetails: "Amaga els detalls",
  showDetails: "Mostra els detalls",
  editVideoDetails: "Edita els detalls del vídeo",
  editImageDetails: "Edita els detalls de la imatge",
  edit: "Edita",
  noTags: "Sense etiquetes",
  addTagEllipsis: "Afegeix etiqueta…",
  noDescription: "Sense descripció.",
  save: "Desa",
  cancel: "Cancel·la",
  delete: "Elimina",
  deleting: "Eliminant…",
  atLeastOneTagRequired: "Cal almenys una etiqueta.",
  couldNotSave: "No s'han pogut desar els canvis.",
  deleteConfirm:
    "Vols eliminar “{name}”? Esborra l'element i el seu media de forma permanent.",
  couldNotDelete: "No s'ha pogut eliminar l'element.",

  enterRating: "Introdueix una valoració",
  enterValidNumber: "Introdueix un número vàlid",
  cantBeMoreThan: "No pot ser més de {max}",
  cantBeLessThan: "No pot ser menys de {min}",
  ratingAria: "Valoració {value}",

  zoomIn: "Apropa",
  zoomOut: "Allunya",
  resetZoom: "Restableix el zoom",
  couldNotLoadImage: "No s'ha pogut carregar aquesta imatge.",

  imageNotFound: "Imatge no trobada",
  backToArchive: "Torna a l'arxiu",
  notFound: "No trobat",

  videoPlayer: "Reproductor de vídeo",
  playVideo: "Reprodueix el vídeo",
  play: "Reprodueix",
  pause: "Pausa",
  mute: "Silencia",
  unmute: "Activa el so",
  seek: "Cerca",
  fullscreen: "Pantalla completa",
  exitFullscreen: "Surt de pantalla completa",
  videoProcessingTitle: "El vídeo s'està processant",
  videoProcessingHint:
    "Bunny Stream encara està codificant aquest vídeo. La reproducció començarà sola quan estigui a punt.",
  videoChecking: "S'està comprovant el vídeo…",
  videoWaitElapsed: "Esperant · {seconds}s",
  videoRetry: "Torna-ho a provar",
  videoRetrying: "S'està comprovant…",
  videoUnavailable: "No s'ha pogut carregar aquest vídeo.",
  videoUnavailableHint:
    "Pot ser que la codificació hagi fallat o que el fitxer encara no estigui a punt. Torna-ho a provar d'aquí a un moment.",
  videoPreviewUnavailable:
    "Aquest navegador no pot previsualitzar aquest fitxer. Tot i així el pots desar — Bunny el codificarà per a la reproducció.",
};

export const messages: Record<Locale, Record<MessageKey, string>> = {
  en,
  es,
  ca,
};

export type TranslateVars = Record<string, string | number>;

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: TranslateVars,
): string {
  const template = messages[locale]?.[key] ?? messages.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}
