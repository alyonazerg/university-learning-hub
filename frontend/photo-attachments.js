(() => {
  'use strict';
  async function prepare(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Photos: JPG, PNG or WebP, up to 5 MB each; up to 3 photos.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('This image is too large.');
      const factor = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * factor)); canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return Object.freeze({name: file.name.slice(0, 150), src: canvas.toDataURL('image/jpeg', 0.85)});
    } finally {URL.revokeObjectURL(url);}
  }
  function gallery(photos = []) {
    const box = document.createElement('div'); box.className = 'photo-gallery';
    for (const photo of photos) {const image = document.createElement('img'); image.src = photo.src; image.alt = 'Attached photo: ' + photo.name; image.loading = 'lazy'; box.append(image);}
    return box;
  }
  function picker(id) {
    const element = document.createElement('div'), label = document.createElement('label'), input = document.createElement('input'), preview = document.createElement('div'), error = document.createElement('p');
    label.className = 'input-label'; label.htmlFor = id; label.textContent = 'Photos · up to 3 files, up to 5 MB each'; input.id = id; input.type = 'file'; input.multiple = true; input.accept = 'image/jpeg,image/png,image/webp';
    error.className = 'form-error'; error.setAttribute('role', 'alert');
    const state = {element, photos: [], busy: false, invalid: false};
    let version = 0;
    input.addEventListener('change', async () => {
      const ticket = ++version; state.busy = true; state.invalid = false; state.photos = []; error.textContent = ''; preview.replaceChildren();
      try {
        const files = Array.from(input.files); if (files.length > 3) throw new Error('Up to 3 photos.');
        const photos = await Promise.all(files.map(prepare));
        if (ticket !== version) return; state.photos = photos; preview.replaceChildren(gallery(photos));
      } catch (reason) {if (ticket === version) {state.invalid = true; error.textContent = reason.message || 'Could not read the photo.';}}
      finally {if (ticket === version) state.busy = false;}
    });
    element.append(label, input, error, preview); return state;
  }
  window.MoonPhotos = Object.freeze({picker, gallery, prepare});
})();
