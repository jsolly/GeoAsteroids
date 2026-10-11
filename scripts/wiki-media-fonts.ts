/**
 * Pins demonstration text to committed Liberation Sans faces.
 *
 * The generator and the game renderers it reuses request `Arial`. Liberation Sans is
 * metric-compatible with Arial, so registering it under that family keeps text layout
 * while removing the host's font installation from the rendered bytes. On Linux an
 * empty fontconfig file hides every system font; it must be set before the first
 * registration initializes fontconfig.
 */
import { resolve } from 'node:path';
import process from 'node:process';
import { registerFont } from 'canvas';

const FONT_DIRECTORY = resolve('scripts/wiki-media-fonts');

process.env['FONTCONFIG_FILE'] = resolve(FONT_DIRECTORY, 'fonts.conf');
registerFont(resolve(FONT_DIRECTORY, 'LiberationSans-Regular.ttf'), { family: 'Arial' });
registerFont(resolve(FONT_DIRECTORY, 'LiberationSans-Bold.ttf'), {
  family: 'Arial',
  weight: 'bold',
});
