import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Downloads (web) or opens the share sheet (native) for a text file. */
export async function shareTextFile(filename: string, contents: string, mimeType = 'text/csv') {
  if (Platform.OS === 'web') {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
}
