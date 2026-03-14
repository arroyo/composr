import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a safe filename from a song name with the given extension.
 * 
 * @param songName - The name of the song
 * @param extension - The file extension (without the dot, e.g., 'json', 'mid')
 * @returns A safe filename with the given extension
 */
export function generateFilename(songName: string, extension: string): string {
  if (!songName) {
    return `song.${extension}`;
  }
  
  // Clean the name: replace spaces with hyphens, limit to 35 chars
  let safeName = songName.replace(/ /g, '-').slice(0, 35);
  // Remove non-alphanumeric characters except hyphens
  safeName = safeName.replace(/[^a-zA-Z0-9-]/g, '');
  // Remove leading/trailing hyphens and replace multiple consecutive hyphens
  safeName = safeName.replace(/^-|-$/g, '');
  safeName = safeName.replace(/-+/g, '-');
  
  if (safeName) {
    return `${safeName}.${extension}`;
  } else {
    return `song.${extension}`;
  }
}
