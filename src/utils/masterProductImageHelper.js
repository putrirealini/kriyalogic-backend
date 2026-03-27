const normalizeMasterProductImages = (images = []) => {
  if (!Array.isArray(images)) return { images: [], coverImage: '' };

  const cleanedImages = images
    .filter((img) => img && img.imageUrl)
    .map((img, index) => ({
      imageUrl: String(img.imageUrl).trim(),
      isCover: Boolean(img.isCover),
      sortOrder: Number(img.sortOrder ?? index + 1)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let coverCandidates = cleanedImages.filter((img) => img.isCover);

  if (coverCandidates.length > 1) {
    let firstFound = false;
    for (const img of cleanedImages) {
      if (img.isCover && !firstFound) {
        firstFound = true;
      } else {
        img.isCover = false;
      }
    }
    coverCandidates = cleanedImages.filter((img) => img.isCover);
  }

  if (cleanedImages.length > 0 && coverCandidates.length === 0) {
    cleanedImages[0].isCover = true;
    coverCandidates = [cleanedImages[0]];
  }

  return {
    images: cleanedImages,
    coverImage: coverCandidates[0]?.imageUrl || ''
  };
};

module.exports = {
  normalizeMasterProductImages
};