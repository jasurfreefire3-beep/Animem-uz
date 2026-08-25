const toSlugLocal = (text) => {
    if (!text) return "";
    return text.toString().toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  };
console.log(toSlugLocal("Sevgi va yolg'on"));
