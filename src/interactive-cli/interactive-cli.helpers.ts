import consola from 'consola';

export function printSpacingBetweenPrompts() {
  consola.log(`\n`);
}

export function promptErrorHandler(promptError: unknown) {
  consola.error('Error reading prompt answer.', promptError);
}
