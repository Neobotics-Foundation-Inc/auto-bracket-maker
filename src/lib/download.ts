/** Saves text as a file through the browser's download, with no server involved. */
export function downloadFile(name: string, text: string, type: string) {
  // A byte-order mark so Excel reads a CSV's accents and symbols as UTF-8.
  const content = type === 'text/csv' ? `﻿${text}` : text;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
